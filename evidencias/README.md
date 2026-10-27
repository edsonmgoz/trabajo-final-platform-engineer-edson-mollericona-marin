# Evidencias

## 01. Entorno local

Cluster k3d y namespaces de plataforma.

| Captura | Comando | Descripción |
|---|---|---|
| [01-cluster-y-nodos.png](01-entorno-local/01-cluster-y-nodos.png) | `k3d cluster list` y `kubectl get nodes -L node` | Cluster `local` con un server y dos agents en estado `Ready`, con las etiquetas `node=system` y `node=workloads` |
| [02-namespaces.png](01-entorno-local/02-namespaces.png) | `kubectl get namespaces` | Namespaces de plataforma creados |
| [03-releases-helm.png](01-entorno-local/03-releases-helm.png) | `helm list -A` | cert-manager, OpenTelemetry Operator, Istio base e istiod instalados con versión fija |
| [04-pods-plataforma.png](01-entorno-local/04-pods-plataforma.png) | `kubectl get pods -A -o wide` | Componentes de plataforma en `Running`: cert-manager, el operador de OpenTelemetry e istiod en el nodo `system` (agent 0) y el gateway de entrada en el nodo `workloads` (agent 1). Los reinicios se deben a las paradas y arranques del cluster con `k3d cluster stop` y `k3d cluster start` |

## 02. Aplicación

| Captura | Origen | Descripción |
|---|---|---|
| [01-imagen-docker-hub.png](02-aplicacion/01-imagen-docker-hub.png) | [Docker Hub](https://hub.docker.com/r/edsonmgoz/products-api/tags) | Imagen `edsonmgoz/products-api` publicada con la etiqueta versionada `v0.1.0` |

## 03. Gitea y CI

| Captura | Origen | Descripción |
|---|---|---|
| [01-repositorio-gitea.png](03-gitea-ci/01-repositorio-gitea.png) | `http://localhost:3000/acme/products-api` | Repositorio público `acme/products-api` en Gitea con la carpeta `.gitea/workflows`, la rama `master`, el tag `v0.1.1` y el último commit con su ejecución en verde |
| [02-action-gitea.png](03-gitea-ci/02-action-gitea.png) | Gitea Actions, ejecución 3 | Workflow `java-docker-buildx.yaml` lanzado por el tag `v0.1.1`: pruebas, login, construcción y publicación de la imagen, todos los pasos en `Success` en 45 segundos |
| [03-imagen-docker-hub.png](03-gitea-ci/03-imagen-docker-hub.png) | [Docker Hub](https://hub.docker.com/r/edsonmgoz/products-api/tags) | Imagen `edsonmgoz/products-api:v0.1.1` publicada por la ejecución anterior para `linux/amd64` y `linux/arm64` |

## 04. GitOps

| Captura | Origen | Descripción |
|---|---|---|
| [01-argocd-aplicaciones.png](04-gitops/01-argocd-aplicaciones.png) | Argo CD, `http://localhost:8080/applications` | `k8s-local-apps` (proyecto `default`, ruta `gitops/clusters/local`) y `products-api` (proyecto `products`, ruta `k8s`, namespace `app`) en `Synced` y `Healthy`, ambas sobre la rama `master` de `http://gitea:3000/acme/products-api.git` |
| [02-argocd-products-api.png](04-gitops/02-argocd-products-api.png) | Argo CD, aplicación `products-api` | Sincronización automática del commit `318cd3c` y árbol de recursos gestionados: Namespace `app`, Service con su EndpointSlice, ServiceAccount, Deployment con su ReplicaSet y el pod `2/2`, y HTTPRoute |
| [03-sync-v0.1.1.png](04-gitops/03-sync-v0.1.1.png) | Argo CD, aplicación `products-api` | Sincronización automática del commit `d3d9f62`, que cambia la imagen a `v0.1.1`: el Deployment pasa a la revisión 2 con un ReplicaSet nuevo y su pod `2/2`, y el ReplicaSet de `v0.1.0` queda sin réplicas |

## 05. Service mesh

| Captura | Comando | Descripción |
|---|---|---|
| [01-gateway-ingress-public.png](05-service-mesh/01-gateway-ingress-public.png) | `kubectl get gatewayclass`, `kubectl get gateway -n istio-system` y `kubectl get pods -n istio-system -o wide` | Gateway `ingress-public` en estado `PROGRAMMED` y su pod en el nodo `workloads` |
| [02-recursos-app.png](05-service-mesh/02-recursos-app.png) | `kubectl get pods,svc,httproute -n app -o wide` | Pod de `products-api` con `2/2` contenedores listos (aplicación y sidecar `istio-proxy`) en el nodo `workloads` (agent 1), Service ClusterIP en el puerto 8080 y HTTPRoute `products-api-route` |
| [03-curl-api.png](05-service-mesh/03-curl-api.png) | `curl -i http://localhost/api/products` | Respuesta `200 OK` servida a través del gateway, con la cabecera `server: istio-envoy` y los cinco productos en JSON |
| [04-logs-istio.png](05-service-mesh/04-logs-istio.png) | `curl -i http://localhost/api/products`, `kubectl logs -n istio-system deploy/ingress-public-istio --tail=5` y `kubectl logs -n app deploy/products-api -c istio-proxy --tail=5` | La misma petición, con el `x-request-id` `93ca341f-6196-4482-8ca2-ac01db871648`, en el access log del gateway (ruta `app.products-api-route.0` hacia `outbound\|8080\|\|products-api.app.svc.cluster.local`) y en el del sidecar (`inbound\|8080\|\|`, con el SNI de mTLS `outbound_.8080_._.products-api.app.svc.cluster.local`). Las rutas no publicadas, como `/` y `/api-docs`, responden `404 route_not_found` |

## 06. Observabilidad

Los gráficos de Prometheus muestran la hora en UTC; la prueba de carga con siege se ejecutó a las 22:53 UTC.

| Captura | Comando o consulta | Descripción |
|---|---|---|
| [01-componentes.png](06-observabilidad/01-componentes.png) | `helm list -A`, `kubectl get pods -n o11y -o wide`, `kubectl get pods -n prometheus -o wide` y `kubectl get pods -n grafana-agent -o wide` | Releases de Prometheus, sus CRDs, k8s-monitoring (revisión 2) y los tres recolectores Alloy en `deployed`; collector, Prometheus, Alloy, kube-state-metrics y node-exporter en `Running` sin reinicios |
| [02-pod-instrumentado.png](06-observabilidad/02-pod-instrumentado.png) | `kubectl -n app get pods -o wide`, `kubectl -n app get pod -l app=products-api -o jsonpath='{range .items[*].spec.initContainers[*]}{.name}{"\n"}{end}'` y `kubectl -n app logs deploy/products-api -c server \| grep -E "opentelemetry-javaagent\|Started ProductsApiApplication"` | Pod de `products-api` con `2/2` contenedores y los init containers `istio-init`, `istio-proxy` y `opentelemetry-auto-instrumentation-java`; el log confirma el agente `2.27.0` y el arranque de la aplicación |
| [03-prometheus-aplicacion.png](06-observabilidad/03-prometheus-aplicacion.png) | `sum by (http_route, http_response_status_code) (rate(http_server_request_duration_seconds_count{service_name="products-api"}[5m]))` | Peticiones por segundo por ruta y código, enviadas por el agente OpenTelemetry, con el pico de la prueba de carga en `/api/products` |
| [04-prometheus-istio.png](06-observabilidad/04-prometheus-istio.png) | `sum by (destination_service_name) (rate(istio_requests_total{reporter="destination", destination_service_name=~"products-api.*"}[5m]))` | La consulta de tráfico de la card de métricas de Backstage, sobre las métricas del sidecar de Istio recogidas por Alloy |
| [05-prometheus-trazas.png](06-observabilidad/05-prometheus-trazas.png) | `sum by (span_name) (rate(traces_span_metrics_calls_total{service_name="products-api", span_name!~".*actuator.*"}[5m]))` | Las trazas del agente convertidas en métricas por el conector `spanmetrics`: petición HTTP, repositorio, consultas JDBC a H2 y commit de la transacción |

## 07. Developer Portal

Backstage en local, en `http://127.0.0.1:7001`. Los gráficos de la pestaña Metrics muestran la hora local (UTC-4).

| Captura | Origen | Descripción |
|---|---|---|
| [01-catalogo.png](07-developer-portal/01-catalogo.png) | Catálogo, filtro `Component` | `products-api` con el system `products`, el owner Team Products, el tipo `service`, el lifecycle `production` y los tags `java`, `spring-boot` y `http` |
| [02-overview-a.png](07-developer-portal/02-overview-a.png) | Entidad `products-api`, pestaña Overview | API `products-api-http-api` de tipo OpenAPI que provee el servicio, ficha About con descripción, owner, system y tags, y enlaces al repositorio de GitHub y a la imagen de Docker Hub |
| [02-overview-b.png](07-developer-portal/02-overview-b.png) | Entidad `products-api`, pestaña Overview | Dependencia del Resource `app-namespace` y grafo de relaciones: `ownedBy` Team Products, `partOf` products, `providesApi` products-api-http-api y `dependsOn` app-namespace |
| [03-card-metrics.png](07-developer-portal/03-card-metrics.png) | Pestaña Metrics, Traffic, ventana de 30 minutos | Latencia p95 y peticiones por segundo de `products-api` durante la prueba de carga con siege, calculadas en Prometheus a partir de las métricas del sidecar de Istio |
| [04-card-gitops-a.png](07-developer-portal/04-card-gitops-a.png) | Pestaña ArgoCD, ArgoCD overview | Application `products-api` de la instancia `argoInstance` en `Synced` y `Healthy` |
| [04-card-gitops-b.png](07-developer-portal/04-card-gitops-b.png) | Pestaña ArgoCD, ArgoCD history | Los cuatro despliegues de la Application con autor, mensaje y revisión; el más reciente es `7f2df6f` (`Raise products-api memory request to 512Mi`), del 27 de octubre de 2026. La columna `Took` muestra la duración con signo negativo, aunque los tiempos que registra Argo CD son correctos: el último despliegue tardó 3 segundos |
| [05-kubernetes.png](07-developer-portal/05-kubernetes.png) | Pestaña Kubernetes | Cluster `local` y Deployment `products-api` del namespace `app` sin pods con errores; el pod `products-api-6cfdcc47fc-nd996` está en `Running` con 0 reinicios, el 11 % del request de CPU y el 69 % de los 512Mi de memoria. El plugin solo cuenta los contenedores principales, por eso muestra `1/1`: `istio-proxy` es un sidecar nativo, un init container con `restartPolicy: Always` |
| [06-techdocs.png](07-developer-portal/06-techdocs.png) | Pestaña TechDocs, página Arquitectura | Documentación generada desde `docs/` con MkDocs: recorrido de una petición y recursos del servicio, con requests de 100m de CPU y 512Mi de memoria |
| [07-docker-images.png](07-developer-portal/07-docker-images.png) | Pestaña Development, Images | Los 14 tags de `edsonmgoz/products-api` en Docker Hub, con `master-adca2673c016` como el más reciente, para `linux/amd64` y `linux/arm64` |

## 08. Políticas

| Captura | Comando u origen | Descripción |
|---|---|---|
| [01-componentes.png](08-politicas/01-componentes.png) | `helm list -n kyverno`, `helm list -n policy-reporter`, `kubectl get pods -n kyverno -o wide` y `kubectl get pods -n policy-reporter -o wide` | Kyverno 3.8.0 (v1.18.0) y policy-reporter 3.7.4 en `deployed`; los cuatro controladores de Kyverno, policy-reporter, su UI y el plugin de Kyverno en `Running` sin reinicios en el nodo `system` (agent 0) |
| [02-politicas-app.png](08-politicas/02-politicas-app.png) | `kubectl get policy -n app` | Las doce políticas del curso en el namespace `app`, activas en admisión y en segundo plano, todas `Ready` |
| [03-policy-report.png](08-politicas/03-policy-report.png) | `kubectl get policyreport -n app -o wide` | Reportes de cumplimiento: Deployment `products-api` con 11 resultados en `pass`, Service y ServiceAccounts `products-api` y `default` con 1 cada uno; ningún `fail` |
| [04-rechazo-admision.png](08-politicas/04-rechazo-admision.png) | `kubectl -n app set image deployment/products-api server=docker.io/edsonmgoz/products-api:latest --dry-run=server` y `kubectl -n app set image deployment/products-api server=docker.io/library/nginx:1.29 --dry-run=server` | El webhook `validate.kyverno.svc-fail` rechaza el cambio de imagen: la primera vez por el tag `latest` y la segunda por un registro no aprobado. Con `--dry-run=server` no se modifica el Deployment |
| [05-policy-reporter-ui.png](08-politicas/05-policy-reporter-ui.png) | policy-reporter, `http://localhost:8082` | Dashboard con los 14 resultados de Kyverno en `pass` para el namespace `app` y el detalle por recurso |
| [06-policy-reporter-ui-kyverno.png](08-politicas/06-policy-reporter-ui-kyverno.png) | policy-reporter, `http://localhost:8082/#/policies/kyverno` | Vista del plugin de Kyverno: las doce políticas agrupadas por categoría (`MitoCode Cloud Native`, `Other` y `Resource Management`) con sus resultados |
