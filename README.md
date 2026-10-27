# products-api

Trabajo final del curso Cloud Native Platform Engineer de MitoCode: golden path de plataforma para un servicio.

products-api es un servicio REST de productos (Java 25, Spring Boot 4.1.1, H2 en memoria). Gitea Actions construye su imagen, Argo CD lo despliega en un cluster k3d local, Istio lo expone, OpenTelemetry y Prometheus lo observan, Kyverno valida sus manifiestos y Backstage lo muestra en el catálogo.

## Arquitectura

```
commit ──> GitHub (origin)
       └─> Gitea acme/products-api ──> Gitea Actions ──> Docker Hub edsonmgoz/products-api
                                   └─> Argo CD ──> k8s/ en el namespace app (admisión de Kyverno)

cliente ──> localhost:80 ──> Gateway ingress-public ──> HTTPRoute /api/products ──> products-api + sidecar de Istio

agente OpenTelemetry, sidecars y Alloy ── OTLP ──> collector ──> Prometheus

Backstage (local) ──> catálogo, TechDocs, Kubernetes, Argo CD, Prometheus, Gitea Actions y Docker Hub
```

| Componente | Namespace | Versión |
|---|---|---|
| k3d (k3s) | Docker Desktop | 5.9.0 (v1.35.5) |
| cert-manager | `kube-system` | 1.20.2 |
| Istio en modo sidecar y Gateway API | `istio-system` | 1.29.2 y v1.5.1 |
| OpenTelemetry Operator | `operators` | 0.159.0 |
| Gitea y act_runner | Docker Compose | 1.26.2 y 0.6.1 |
| Argo CD | `argocd` | 3.3.9 |
| Collector de OpenTelemetry | `o11y` | 0.159.0 |
| Prometheus | `prometheus` | 3.11.3 |
| k8s-monitoring (Alloy) | `grafana-agent` | 4.0.3 |
| Kyverno y policy-reporter | `kyverno`, `policy-reporter` | 1.18.0 y 3.7.4 |
| Backstage | local | 1.54.0 |

El detalle de recursos y del recorrido de una petición está en [`docs/arquitectura.md`](docs/arquitectura.md), publicado también en TechDocs.

## Repositorio

| Ruta | Contenido |
|---|---|
| `src/` | Código del servicio |
| `Dockerfile` | Imagen en dos etapas con usuario sin privilegios |
| `.gitea/workflows/` | Pipeline de CI |
| `k8s/` | Namespace, ServiceAccount, Deployment, Service y HTTPRoute |
| `gitops/` | Application raíz, AppProject y Application de Argo CD |
| `stack/` | Configuración de la plataforma: k3d, values de Helm, Gitea, collector, políticas y Backstage |
| `catalog-info.yaml` | Entidades de Backstage |
| `mkdocs.yml`, `docs/` | TechDocs |
| `evidencias/` | Capturas por módulo |

## Comandos

Ejecutados en macOS desde la raíz del repositorio, con Docker Desktop 29.8.1, k3d 5.9.0, kubectl 1.36.1, Helm 4.3.0 e istioctl 1.29.2.

### 1. Entorno local

Cluster `local` con un server y dos agents: `node=system` para la plataforma y `node=workloads` para el gateway y el servicio.

```bash
k3d cluster create --config stack/environment/k3d/base.yml
helm repo add jetstack https://charts.jetstack.io
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update
helm upgrade cert-manager jetstack/cert-manager --install -n kube-system --version 1.20.2 -f stack/cert-manager/values-cert-manager.yml
helm upgrade opentelemetry-operator open-telemetry/opentelemetry-operator --version 0.123.1 --install -n operators --create-namespace -f stack/otel/values-operator.yml
helm upgrade --install istio-base istio/base -n istio-system --create-namespace --version 1.29.2 --wait -f stack/istio/istio-base-values.yaml
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.5.1/standard-install.yaml
helm upgrade --install istiod istio/istiod --namespace istio-system --version 1.29.2 --wait -f stack/istio/istiod-values.yaml
curl -sL https://istio.io/downloadIstioctl | ISTIO_VERSION=1.29.2 sh -
kubectl apply -f stack/istio/gateway-ingress.yaml
```

### 2. Aplicación

Endpoints: `GET`, `POST` en `/api/products` y `GET`, `PUT`, `DELETE` en `/api/products/{id}`. La imagen nunca usa la etiqueta `latest`.

```bash
./gradlew build
docker build -t edsonmgoz/products-api:v0.1.0 .
docker login
docker push edsonmgoz/products-api:v0.1.0
```

### 3. Gitea y CI

Gitea y su runner corren con Docker Compose. Gitea se une a la red `k3d-local` con el alias `gitea`, por eso el cluster lo alcanza en `http://gitea:3000`. El token de registro del runner (`stack/gitea/.env`) y las credenciales de Docker Hub (`stack/gitea/runner-data/job.env`) no se versionan.

```bash
docker compose -f stack/gitea/docker-compose.yaml up -d gitea
docker compose -f stack/gitea/docker-compose.yaml --profile runner run --rm runner-register
docker compose -f stack/gitea/docker-compose.yaml --profile runner up -d runner
git remote add gitea http://localhost:3000/acme/products-api.git
git push gitea master
git tag -a v0.1.1 -m "Release v0.1.1"
git push gitea v0.1.1
git push origin v0.1.1
```

`.gitea/workflows/java-docker-buildx.yaml` ejecuta las pruebas, construye la imagen para linux/amd64 y linux/arm64 y la publica como `master-<sha>` en cada push a `master` o como `vX.Y.Z` en cada tag.

### 4. GitOps

Patrón app of apps: `k8s-local-apps` crea el AppProject `products` y la Application `products-api`, que sincroniza `k8s/` con `prune` y `selfHeal`. Después del despliegue inicial, todos los cambios llegaron por Git: la imagen `v0.1.1`, la instrumentación de OpenTelemetry y el request de memoria de 512Mi.

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm upgrade --install argocd argo/argo-cd -n argocd --create-namespace --version 9.5.11 --wait -f stack/argo/argocd-values.yaml
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
kubectl -n argocd port-forward svc/argocd-server 8080:80
kubectl apply -f stack/argo/repository-secret.yaml
kubectl apply -f gitops/k8s-local-apps.yaml
kubectl -n argocd get applications
```

### 5. Service mesh

El namespace `app` tiene la etiqueta `istio-injection=enabled`. El Gateway solo publica `/api/products`, y el tráfico del gateway al pod viaja con mTLS.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/products-api.yaml
kubectl get pods,svc,httproute -n app -o wide
curl -i http://localhost/api/products
kubectl logs -n istio-system deploy/ingress-public-istio --tail=5
kubectl logs -n app deploy/products-api -c istio-proxy --tail=5
```

### 6. Observabilidad

El agente Java de OpenTelemetry (inyectado por el operador), los sidecars de Istio y Alloy envían la telemetría al collector, y el collector escribe las métricas en Prometheus por remote write.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm upgrade --install prometheus-operator-crds prometheus-community/prometheus-operator-crds -n monitoring --create-namespace --version 32.0.2
helm upgrade --install prometheus prometheus-community/prometheus -n prometheus --create-namespace --version 29.6.0 -f stack/prometheus/values-server.yaml
kubectl create ns o11y
kubectl apply -f stack/otel/otel-collector.yaml
kubectl apply -f stack/istio/telemetry.yaml
helm upgrade --install k8s-monitoring grafana/k8s-monitoring -n grafana-agent --create-namespace --version 4.0.3 -f stack/k8s-monitoring/values.yaml --timeout 15m
kubectl apply -f stack/otel/autoinstrumentation.yaml
brew install siege
siege -c 15 -t 60S http://localhost/api/products
kubectl -n prometheus port-forward svc/prometheus-server 9090:80
```

Consultas en `http://localhost:9090`:

```promql
sum by (http_route, http_response_status_code) (rate(http_server_request_duration_seconds_count{service_name="products-api"}[5m]))
sum by (destination_service_name) (rate(istio_requests_total{reporter="destination", destination_service_name=~"products-api.*"}[5m]))
sum by (span_name) (rate(traces_span_metrics_calls_total{service_name="products-api", span_name!~".*actuator.*"}[5m]))
```

### 7. Developer Portal

Backstage (`stack/backstage/demo-idp-2`) corre en local, como en los laboratorios del curso. Lee las entidades de `catalog-info.yaml` desde Gitea e integra TechDocs, Kubernetes, Argo CD, Prometheus (card de métricas), Gitea Actions y Docker Hub. Las credenciales se pasan como variables de entorno.

```bash
brew install node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"
npm install -g yarn
echo "127.0.0.1 gitea" | sudo tee -a /etc/hosts
cd stack/backstage/demo-idp-2
yarn install
yarn tsc
kubectl -n argocd port-forward svc/argocd-server 8080:80
kubectl -n prometheus port-forward svc/prometheus-server 9090:80
kubectl proxy --port=8001
read -rs GITEA_TOKEN && export GITEA_TOKEN
export ARGOCD_USERNAME=admin
export ARGOCD_PASSWORD="$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)"
yarn start
```

Los port-forwards y `kubectl proxy` se ejecutan cada uno en su propia terminal. El portal queda en `http://127.0.0.1:7001`.

### 8. Políticas de plataforma

Las doce políticas de Kyverno del curso, en modo `Enforce` sobre el namespace `app`, están en `stack/kyverno/policies/`.

```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo add policy-reporter https://kyverno.github.io/policy-reporter
helm repo update
helm upgrade --install kyverno kyverno/kyverno -n kyverno --create-namespace --version 3.8.0 -f stack/kyverno/values.yaml
helm upgrade --install policy-reporter policy-reporter/policy-reporter --namespace policy-reporter --create-namespace --version 3.7.4 -f stack/kyverno/values-pr.yaml
kubectl apply -f stack/kyverno/policies/
kubectl get policyreport -n app -o wide
kubectl -n app set image deployment/products-api server=docker.io/edsonmgoz/products-api:latest --dry-run=server
kubectl -n app set image deployment/products-api server=docker.io/library/nginx:1.29 --dry-run=server
kubectl -n policy-reporter port-forward svc/policy-reporter-ui 8082:8080
```

## Evidencias

Capturas por módulo en [`evidencias/`](evidencias/README.md).

## Enlaces

| Recurso | Dirección |
|---|---|
| Repositorio en GitHub | https://github.com/edsonmgoz/trabajo-final-platform-engineer-edson-mollericona-marin |
| Imagen en Docker Hub | https://hub.docker.com/r/edsonmgoz/products-api/tags |
| Gitea (local) | http://localhost:3000/acme/products-api |
| API (local) | http://localhost/api/products |
| Argo CD (local) | http://localhost:8080 |
| Prometheus (local) | http://localhost:9090 |
| policy-reporter (local) | http://localhost:8082 |
| Backstage (local) | http://127.0.0.1:7001 |
