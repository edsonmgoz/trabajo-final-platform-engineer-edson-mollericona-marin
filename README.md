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

Imagen publicada: [edsonmgoz/products-api](https://hub.docker.com/r/edsonmgoz/products-api/tags). La etiqueta `v0.1.0` (linux/arm64) se construyó en local; desde `v0.1.1` las imágenes las construye el pipeline de Gitea para linux/amd64 y linux/arm64.

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
| Argo CD | `argocd` | chart 9.5.11 (Argo CD v3.3.9) | `stack/argo/argocd-values.yaml` |
| CRDs de Prometheus Operator | `monitoring` | chart 32.0.2 (v0.94.2) | valores por defecto |
| Prometheus | `prometheus` | chart 29.6.0 (Prometheus v3.11.3) | `stack/prometheus/values-server.yaml` |
| Collector de OpenTelemetry | `o11y` | otelcol-contrib 0.159.0 | `stack/otel/otel-collector.yaml` |
| k8s-monitoring | `grafana-agent` | chart 4.0.3 (Alloy v1.15.0) | `stack/k8s-monitoring/values.yaml` |
| Kyverno | `kyverno` | chart 3.8.0 (Kyverno v1.18.0) | `stack/kyverno/values.yaml` |
| policy-reporter | `policy-reporter` | chart 3.7.4 | `stack/kyverno/values-pr.yaml` |

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

## Gitea y CI

Gitea y su runner corren fuera del cluster con Docker Compose (`stack/gitea/`). El contenedor de Gitea se conecta a la red `k3d-local` con el alias `gitea`, de modo que el cluster lo alcanza en `http://gitea:3000`; desde el host responde en `http://localhost:3000`.

```bash
docker compose -f stack/gitea/docker-compose.yaml up -d gitea
```

La instalación se completa en el asistente web, donde se crea el usuario administrador con su email.

El runner se registra con el token que genera Gitea en Site Administration > Actions > Runners, guardado en `stack/gitea/.env`. Las credenciales de Docker Hub que usan los jobs (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` y `DOCKERHUB_NAMESPACE`) van en `stack/gitea/runner-data/job.env`, con un token de acceso de Docker Hub de lectura y escritura. Ninguno de los dos archivos se versiona.

```bash
docker compose -f stack/gitea/docker-compose.yaml --profile runner run --rm runner-register
docker compose -f stack/gitea/docker-compose.yaml --profile runner up -d runner
```

El código se publica en el repositorio público `acme/products-api` de Gitea, añadido como segundo remote. GitHub sigue siendo el remote `origin`.

```bash
git remote add gitea http://localhost:3000/acme/products-api.git
git push gitea master
git tag -a v0.1.1 -m "Release v0.1.1"
git push gitea v0.1.1
git push origin v0.1.1
```

### Pipeline

`.gitea/workflows/java-docker-buildx.yaml` se ejecuta en cada push a `master`, en cada tag `vX.Y.Z` y en los pull requests hacia `master`:

1. Ejecuta las pruebas con Gradle sobre Temurin 25.
2. Inicia sesión en Docker Hub y construye la imagen con Docker Buildx y QEMU para linux/amd64 y linux/arm64, con la etiqueta `buildcache` como caché de capas.
3. Publica `master-<sha>` en los push a `master` y `vX.Y.Z` en los tags. Nunca publica `latest`. En los pull requests solo construye.

La imagen del runner ya incluye Docker, por lo que el paso que instala la CLI solo actúa si no la encuentra.

## Despliegue en Kubernetes

Los manifiestos del servicio están en `k8s/`. `namespace.yaml` crea el namespace `app` con la etiqueta `istio-injection=enabled`, de modo que cada pod recibe el sidecar de Istio. `products-api.yaml` declara el ServiceAccount, el Deployment, el Service y el HTTPRoute.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/products-api.yaml
kubectl -n app rollout status deployment/products-api --timeout=180s
```

Ese fue el despliegue inicial, con la imagen `v0.1.0`. Desde que Argo CD gestiona `k8s/`, los cambios llegan al cluster solo a través de Git (ver [GitOps con Argo CD](#gitops-con-argo-cd)).

| Recurso | Configuración |
|---|---|
| ServiceAccount `products-api` | Sin montaje automático del token de la API de Kubernetes |
| Deployment `products-api` | Una réplica en el nodo `workloads` con la imagen `v0.1.1`. Se ejecuta con el usuario 1000, sin capabilities ni escalada de privilegios y con el sistema de archivos raíz en solo lectura; `/tmp` es un volumen `emptyDir`. Requests de 100m de CPU y 512Mi de memoria, límites de 1 CPU y 512Mi. Sondas de readiness y liveness sobre `/actuator/health/readiness` y `/actuator/health/liveness` |
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

## GitOps con Argo CD

Argo CD se instala con Helm en el namespace `argocd` y todos sus componentes corren en el nodo `system`. `stack/argo/argocd-values.yaml` espacia las consultas al repositorio (cada 180 s, con hasta 60 s de variación), calcula las diferencias en el servidor, sigue los recursos por anotación, excluye los informes de Kyverno y sirve la interfaz por HTTP.

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace --version 9.5.11 --wait -f stack/argo/argocd-values.yaml
```

La interfaz queda en `http://localhost:8080` con un port-forward. Se entra con el usuario `admin` y la contraseña inicial que genera la instalación.

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
kubectl -n argocd port-forward svc/argocd-server 8080:80
```

Argo CD lee el repositorio desde Gitea, en `http://gitea:3000/acme/products-api.git`. `stack/argo/repository-secret.yaml` lo registra; como el repositorio es público, el Secret no lleva credenciales.

```bash
kubectl apply -f stack/argo/repository-secret.yaml
```

### Aplicaciones

```
gitops/
├── k8s-local-apps.yaml                            Application raíz
└── clusters/local/
    ├── project-app.yaml                           AppProject products
    └── apps/project-products/products-api.yaml    Application del servicio
```

Las aplicaciones siguen el patrón app of apps. `k8s-local-apps` recorre `gitops/clusters/local` y crea primero el AppProject `products` (sync-wave `-1`) y después la Application `products-api` (sync-wave `0`). El proyecto solo admite este repositorio como origen y el namespace `app` como destino.

`products-api` despliega la carpeta `k8s/` de la rama `master` con sincronización automática, `prune` y `selfHeal`: lo que se elimina de Git se elimina del cluster y los cambios manuales se revierten. El HTTPRoute lleva la sync-wave `1` para aplicarse después del Deployment y el Service.

La Application raíz es lo único que se aplica a mano, una vez publicada la carpeta `gitops/` en Gitea. Argo CD adoptó los recursos que ya existían en `app` sin recrearlos.

```bash
kubectl apply -f gitops/k8s-local-apps.yaml
```

### Cambios por Git

Para desplegar `v0.1.1`, la imagen que el pipeline construyó a partir del tag, se cambió la etiqueta en `k8s/products-api.yaml` y se publicó el commit en GitHub y en Gitea, sin ningún comando sobre el cluster:

```bash
git push gitea master
```

Argo CD detectó el commit `d3d9f62` en su siguiente consulta, tres minutos y medio después del push, y lo sincronizó por su cuenta. El Deployment creó un ReplicaSet con `v0.1.1` y retiró el de `v0.1.0` cuando el pod nuevo estuvo listo.

### Comprobación

```bash
kubectl -n argocd get applications
kubectl -n app get rs -o wide
kubectl -n app logs deploy/products-api -c server | grep "Starting ProductsApiApplication"
curl -i http://localhost/api/products
```

Las dos aplicaciones aparecen como `Synced` y `Healthy`, el ReplicaSet activo usa `v0.1.1` y el log de arranque muestra `Starting ProductsApiApplication v0.1.1`.

## Observabilidad

Un collector de OpenTelemetry en el namespace `o11y` recibe por OTLP las métricas, trazas y logs del cluster y escribe las métricas en Prometheus. Todo corre en local, sin servicios externos.

```
products-api (agente Java)   ── OTLP 4318 ──┐
gateway y sidecars de Istio  ── OTLP 4317 ──┼──> collector otel (o11y) ── remote write ──> Prometheus (prometheus)
Alloy (k8s-monitoring)       ── OTLP 4318 ──┘
```

### Prometheus

Prometheus no hace scrapes propios: recibe las métricas por remote write desde el collector (`web.enable-remote-write-receiver`). Corre como StatefulSet en el nodo `system`, con un volumen de 20Gi en `local-path` y 30 días de retención. Los CRDs de Prometheus Operator se instalan antes porque Alloy descubre los `ServiceMonitor` y `PodMonitor` del cluster.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install prometheus-operator-crds prometheus-community/prometheus-operator-crds -n monitoring --create-namespace --version 32.0.2
helm upgrade --install prometheus prometheus-community/prometheus -n prometheus --create-namespace --version 29.6.0 -f stack/prometheus/values-server.yaml
```

### Collector

```bash
kubectl create ns o11y
kubectl apply -f stack/otel/otel-collector.yaml
```

El operador de OpenTelemetry crea el StatefulSet y el Service `otel-collector.o11y`, con los puertos 4317 (gRPC) y 4318 (HTTP). Sus pipelines:

| Pipeline | Origen | Destino |
|---|---|---|
| `metrics/infra` | métricas sin SDK (Alloy) | Prometheus |
| `metrics/applications` | métricas con `telemetry.sdk.language` (agente Java), con `k8s.cluster.name` y `deployment.environment` en `local` | Prometheus |
| `traces` | spans del agente y de Istio | conectores `spanmetrics` y `servicegraph` |
| `metrics/spanmetrics_servicegraph` | los dos conectores: llamadas, latencia y dependencias (`traces_span_metrics_*`, `traces_service_graph_*`) | Prometheus |
| `logs` | logs del agente y de Alloy | exporter `debug` |

### Trazas de Istio

```bash
kubectl apply -f stack/istio/telemetry.yaml
```

La `Telemetry` `mesh` activa el proveedor `otel-traces`, ya definido en `stack/istio/istiod-values.yaml`, con un muestreo del 100 %: el gateway y los sidecars envían un span por petición al collector.

### Métricas de infraestructura

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm upgrade --install k8s-monitoring grafana/k8s-monitoring -n grafana-agent --create-namespace --version 4.0.3 -f stack/k8s-monitoring/values.yaml --timeout 15m
```

Alloy recoge las métricas del kubelet y de cAdvisor, de los nodos, de kube-state-metrics y de Istio (sidecars e istiod), además de los logs de los pods y los eventos del cluster, y lo envía todo al collector. Entre esas métricas están las que consulta la card de métricas de Backstage: `istio_requests_total`, `istio_request_duration_milliseconds_bucket`, `container_cpu_usage_seconds_total` y `kube_pod_container_resource_requests`.

El hook `post-install` del chart descarga una imagen de `ghcr.io` que tardó más que los 5 minutos que Helm espera por defecto; de ahí el `--timeout 15m`. Los values excluyen el namespace `o11y` de la recogida de logs, porque el exporter `debug` imprime cada registro que recibe y, sin la exclusión, esas líneas volvían al collector en bucle.

### Instrumentación de products-api

```bash
kubectl apply -f stack/otel/autoinstrumentation.yaml
```

La `Instrumentation` del namespace `app` define el agente Java 2.27.0, el envío OTLP en `http/protobuf` al collector y el muestreo `parentbased_always_on`. La plantilla del pod en `k8s/products-api.yaml` lleva tres anotaciones:

| Anotación | Efecto |
|---|---|
| `instrumentation.opentelemetry.io/inject-java: "true"` | el operador inyecta el agente al crear el pod |
| `instrumentation.opentelemetry.io/container-names: server` | solo en el contenedor de la aplicación |
| `traffic.sidecar.istio.io/excludeOutboundPorts: "4317,4318"` | el tráfico hacia el collector no pasa por el sidecar |

Las anotaciones llegaron al cluster por Git, como cualquier cambio de `k8s/`: Argo CD sincronizó el commit y el pod nuevo arrancó con el init container `opentelemetry-auto-instrumentation-java`. El agente envía métricas HTTP, de la JVM y del pool JDBC, trazas (incluidas las consultas a H2) y los logs de Spring.

### Prueba de carga

```bash
brew install siege
siege -c 15 -t 60S http://localhost/api/products
```

La prueba hizo 32.724 peticiones, todas con respuesta 200. La misma cifra aparece en las métricas HTTP del agente, en `istio_requests_total` y en las métricas de trazas del gateway, del sidecar y del agente.

### Comprobación

```bash
kubectl -n prometheus port-forward svc/prometheus-server 9090:80
```

Consultas en `http://localhost:9090`:

```promql
sum by (http_route, http_response_status_code) (rate(http_server_request_duration_seconds_count{service_name="products-api"}[5m]))
sum by (destination_service_name) (rate(istio_requests_total{reporter="destination", destination_service_name=~"products-api.*"}[5m]))
sum by (span_name) (rate(traces_span_metrics_calls_total{service_name="products-api", span_name!~".*actuator.*"}[5m]))
```

Las métricas del agente y las de trazas llegan cada 60 segundos, así que las consultas usan una ventana de 5 minutos.

## Políticas con Kyverno

Kyverno aplica en el namespace `app` las doce políticas de plataforma del módulo de Kyverno del curso, y policy-reporter muestra sus resultados.

```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm upgrade --install kyverno kyverno/kyverno -n kyverno --create-namespace --version 3.8.0 -f stack/kyverno/values.yaml
helm repo add policy-reporter https://kyverno.github.io/policy-reporter
helm repo update
helm upgrade --install policy-reporter policy-reporter/policy-reporter --namespace policy-reporter --create-namespace --version 3.7.4 -f stack/kyverno/values-pr.yaml
```

Los cuatro controladores de Kyverno (admisión, background, limpieza y reportes) corren con una réplica en el nodo `system`, y el escaneo en segundo plano revisa cada 4 horas los recursos que ya existen. En el chart 3.7.4 de policy-reporter el plugin de Kyverno se activa con `plugin.kyverno.enabled`; las claves `ui.plugins.kyverno` y `kyvernoPlugin` de los values del curso pertenecen a la versión 2 del chart y no tienen efecto.

### Políticas

```bash
kubectl apply -f stack/kyverno/policies/
```

| Archivo | Política | Exige |
|---|---|---|
| `01-resource-requests-limits.yaml` | `require-container-resources` | requests de CPU y memoria y límite de memoria en contenedores e init containers |
| `02-container-security-context.yaml` | `restrict-container-security-context` | sin `privileged` ni escalada de privilegios, sistema de archivos de solo lectura y `capabilities.drop: [ALL]` |
| `03-run-as-non-root.yaml` | `require-run-as-non-root` | `runAsNonRoot: true` en el pod o en todos sus contenedores |
| `04-approved-images-no-latest.yaml` | `restrict-images-and-latest-tag` | imágenes de `us-central1-docker.pkg.dev` o de `edsonmgoz` en Docker Hub, con tag distinto de `latest` o digest |
| `05-readiness-liveness-probes.yaml` | `require-liveness-readiness-probes` | sondas de readiness y liveness |
| `06-node-selector-workloads.yaml` | `require-workloads-node-selector` | `nodeSelector` `node: workloads` |
| `07-ownership-labels.yaml` | `require-ownership-labels` | etiquetas `owner`, `environment` y `app.kubernetes.io/name` en el Deployment y en el pod |
| `08-grpc-service-appprotocol.yaml` | `require-grpc-appprotocol` | `appProtocol: grpc` en los puertos `grpc` de los Services |
| `09-serviceaccount-automount-false.yaml` | `disable-serviceaccount-token-automount` | `automountServiceAccountToken: false` en las ServiceAccounts |
| `10-no-plain-text-secrets-env.yaml` | `block-plain-text-secret-env` | `secretKeyRef` en las variables de entorno con nombre sensible |
| `11-otel-annotations.yaml` | `require-otel-annotations` | `instrumentation.opentelemetry.io/container-names` cuando el pod pide inyección de OpenTelemetry |
| `12-termination-grace-period.yaml` | `require-minimum-termination-grace-period` | `terminationGracePeriodSeconds` de al menos 5 |

Son `Policy` de `kyverno.io/v1` en modo `Enforce` con escaneo en segundo plano, igual que en los laboratorios, con dos cambios: el namespace pasa de `default` a `app` y la política de registros admite `edsonmgoz` en lugar del namespace de Docker Hub del curso. Las tres primeras incluyen también `Rollout` de Argo Rollouts; como Argo Rollouts no está instalado, Kyverno avisa al crearlas y las aplica al resto de tipos. Kyverno marca como obsoletas `Policy` y `ClusterPolicy` de `kyverno.io/v1` y prevé retirarlas en la versión 1.20; la versión instalada, 1.18, las admite.

Las políticas validan la plantilla del Deployment, no el Pod, de modo que los contenedores que añaden Istio y el operador de OpenTelemetry al crear el pod no se evalúan.

La ServiceAccount `default` que Kubernetes crea en el namespace no cumplía la política 09. `k8s/namespace.yaml` la declara con `automountServiceAccountToken: false`, y Argo CD la sincronizó como cualquier otro cambio de `k8s/`; la actualización pasó por la admisión de Kyverno.

### Comprobación

```bash
kubectl get policy -n app
kubectl get policyreport -n app -o wide
kubectl -n app set image deployment/products-api server=docker.io/edsonmgoz/products-api:latest --dry-run=server
kubectl -n app set image deployment/products-api server=docker.io/library/nginx:1.29 --dry-run=server
kubectl -n policy-reporter port-forward svc/policy-reporter-ui 8082:8080
```

Las doce políticas aparecen como `Ready`. Los reportes de `app` suman 14 resultados en `pass` y ninguno en `fail`: 11 del Deployment, 1 del Service y 1 de cada ServiceAccount. Los dos `set image` con `--dry-run=server` no modifican nada y terminan con `admission webhook "validate.kyverno.svc-fail" denied the request`, uno por el tag `latest` y otro por el registro. La interfaz de policy-reporter queda en `http://localhost:8082`.

## Evidencias

Las capturas de cada paso están en [`evidencias/`](evidencias/README.md), ordenadas por módulo del trabajo.
