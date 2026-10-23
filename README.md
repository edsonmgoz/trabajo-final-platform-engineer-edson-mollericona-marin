# products-api

Servicio REST de productos desarrollado como trabajo final del curso Cloud Native Platform Engineer.

## Stack

| Componente | Versión |
|---|---|
| Java | 25 (LTS) |
| Spring Boot | 4.1.1 |
| Gradle | 9.7.1 mediante wrapper |
| Base de datos | H2 en memoria |
| Documentación de API | springdoc-openapi 3.1.0 |

## Ejecución

```bash
./gradlew bootRun
```

El servicio queda escuchando en `http://localhost:8080` con cinco productos ya cargados.

Para compilar y ejecutar las pruebas:

```bash
./gradlew build
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/products` | Lista todos los productos |
| GET | `/api/products/{id}` | Obtiene un producto |
| POST | `/api/products` | Crea un producto |
| PUT | `/api/products/{id}` | Actualiza un producto |
| DELETE | `/api/products/{id}` | Elimina un producto |

Documentación interactiva en `http://localhost:8080/swagger-ui.html` y especificación OpenAPI en `http://localhost:8080/api-docs`.

El estado del servicio se consulta en `http://localhost:8080/actuator/health`.

## Estructura

El código sigue una separación en capas:

```
dev.edsonmm.products
├── presentation    controlador REST, request y response
├── domain          entidad, mapper y servicio
├── data            repositorio JPA
├── exception       excepciones y manejador global
└── config          configuración de OpenAPI
```

## Contenedor

El `Dockerfile` usa dos etapas: compila con `eclipse-temurin:25-jdk-noble` y ejecuta el JAR sobre `eclipse-temurin:25-jre-alpine` con el usuario sin privilegios `app` (uid y gid 1000). La imagen se etiqueta con la versión del servicio y nunca con `latest`.

```bash
docker build -t edsonmgoz/products-api:v0.1.0 .
docker login
docker push edsonmgoz/products-api:v0.1.0
```

Imagen publicada: [edsonmgoz/products-api](https://hub.docker.com/r/edsonmgoz/products-api/tags), etiqueta `v0.1.0` (linux/arm64).

## Entorno local de plataforma

Los archivos de configuración de cada componente están en `stack/` y los comandos se ejecutan desde la raíz del repositorio.

Herramientas usadas en macOS:

| Herramienta | Versión |
|---|---|
| Docker Desktop (engine) | 29.8.1 |
| k3d | 5.9.0 (k3s v1.35.5) |
| kubectl | 1.36.1 |
| Helm | 4.3.0 |
| istioctl | 1.29.2 |

### 1. Cluster k3d

```bash
k3d cluster create --config stack/environment/k3d/base.yml
```

El cluster `local` tiene un server y dos agents. El agent 0 lleva la etiqueta `node=system` y aloja los componentes de plataforma; el agent 1 lleva `node=workloads` y aloja el gateway de entrada y la aplicación. Traefik está deshabilitado porque la entrada de tráfico la resuelve Istio. El balanceador de k3d publica en el host, entre otros, los puertos 80 y 443.

Para detener y reanudar el cluster sin perder su estado:

```bash
k3d cluster stop local
k3d cluster start local
```

### 2. cert-manager

Emite los certificados de los webhooks del operador de OpenTelemetry.

```bash
helm repo add jetstack https://charts.jetstack.io && helm repo update
helm upgrade cert-manager jetstack/cert-manager --install -n kube-system --version 1.20.2 -f stack/cert-manager/values-cert-manager.yml
```

### 3. OpenTelemetry Operator

Gestiona los recursos `Instrumentation` y `OpenTelemetryCollector`, con los que se instrumentará el servicio sin tocar su código.

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
helm upgrade opentelemetry-operator open-telemetry/opentelemetry-operator --version 0.123.1 --install -n operators --create-namespace -f stack/otel/values-operator.yml
```

### 4. Istio en modo sidecar

Primero se instalan los CRDs de Istio (`base`), luego los CRDs de Gateway API v1.5.1 (canal standard) y por último el control plane (`istiod`).

```bash
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update
helm upgrade --install istio-base istio/base -n istio-system --create-namespace --version 1.29.2 --wait -f stack/istio/istio-base-values.yaml
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.1/standard-install.yaml
helm upgrade --install istiod istio/istiod --namespace istio-system --version 1.29.2 --wait -f stack/istio/istiod-values.yaml
```

### 5. istioctl

Se instala la misma versión que el control plane:

```bash
curl -sL https://istio.io/downloadIstioctl | ISTIO_VERSION=1.29.2 sh -
echo 'export PATH="$HOME/.istioctl/bin:$PATH"' >> ~/.zshrc
```

### 6. Gateway de entrada

`stack/istio/gateway-ingress.yaml` crea el Gateway `ingress-public` en `istio-system`, con un listener HTTP en el puerto 80 que acepta rutas de los namespaces `default` y `app`. El ConfigMap `ingress-gw-options` lleva los pods del gateway al nodo `workloads`.

```bash
kubectl apply -f stack/istio/gateway-ingress.yaml
```

### Resumen

| Componente | Namespace | Versión | Configuración |
|---|---|---|---|
| cert-manager | `kube-system` | 1.20.2 | `stack/cert-manager/values-cert-manager.yml` |
| OpenTelemetry Operator | `operators` | chart 0.123.1 (operador 0.159.0) | `stack/otel/values-operator.yml` |
| Istio base | `istio-system` | 1.29.2 | `stack/istio/istio-base-values.yaml` |
| Gateway API CRDs | (cluster) | v1.5.1 standard | manifiesto oficial |
| istiod | `istio-system` | 1.29.2 | `stack/istio/istiod-values.yaml` |
| Gateway `ingress-public` | `istio-system` | Gateway API v1 | `stack/istio/gateway-ingress.yaml` |

### Comprobación

```bash
kubectl get nodes -L node
kubectl get namespaces
helm list -A
kubectl get pods -A -o wide
kubectl get gateway -n istio-system
istioctl version
curl -i localhost
```

## Despliegue en Kubernetes

Los manifiestos del servicio están en `k8s/`. `namespace.yaml` crea el namespace `app` con la etiqueta `istio-injection=enabled`, de modo que cada pod recibe el sidecar de Istio. `products-api.yaml` declara el ServiceAccount, el Deployment, el Service y el HTTPRoute.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/products-api.yaml
kubectl -n app rollout status deployment/products-api --timeout=180s
```

| Recurso | Configuración |
|---|---|
| ServiceAccount `products-api` | Sin montaje automático del token de la API de Kubernetes |
| Deployment `products-api` | Una réplica en el nodo `workloads` con la imagen `v0.1.0`. Se ejecuta con el usuario 1000, sin capabilities ni escalada de privilegios y con el sistema de archivos raíz en solo lectura; `/tmp` es un volumen `emptyDir`. Requests de 100m de CPU y 256Mi de memoria, límites de 1 CPU y 512Mi. Sondas de readiness y liveness sobre `/actuator/health/readiness` y `/actuator/health/liveness` |
| Service `products-api` | ClusterIP en el puerto 8080 (`http`) |
| HTTPRoute `products-api-route` | Enlaza el prefijo `/api/products` del Gateway `ingress-public` con el Service |

Las etiquetas `owner`, `environment` y `app.kubernetes.io/name` identifican al equipo, el entorno y la aplicación, y la anotación `backstage.io/kubernetes-id` relaciona los recursos con su entidad en Backstage.

El gateway solo publica `/api/products`; Actuator y Swagger quedan accesibles únicamente dentro del cluster. El servicio corre con una sola réplica porque la base H2 vive en la memoria de cada pod.

### Comprobación

```bash
kubectl get pods,svc,httproute -n app -o wide
curl -i http://localhost/api/products
kubectl logs -n istio-system deploy/ingress-public-istio --tail=5
kubectl logs -n app deploy/products-api -c istio-proxy --tail=5
```

El pod aparece con `2/2` contenedores listos: la aplicación y el sidecar `istio-proxy`. La respuesta llega con la cabecera `server: istio-envoy` y la misma petición queda registrada en el access log del gateway y en el del sidecar. El tráfico entre ambos viaja cifrado con mTLS.

## Evidencias

Las capturas de cada paso están en [`evidencias/`](evidencias/README.md), ordenadas por módulo del trabajo.
