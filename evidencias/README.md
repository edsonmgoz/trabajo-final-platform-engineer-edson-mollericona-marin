# Evidencias

## 01. Entorno local

| Captura | Muestra |
|---|---|
| [01-cluster-y-nodos.png](01-entorno-local/01-cluster-y-nodos.png) | `k3d cluster list` y `kubectl get nodes -L node`: un server y dos agents `Ready`, con las etiquetas `system` y `workloads` |
| [02-namespaces.png](01-entorno-local/02-namespaces.png) | `kubectl get namespaces -L istio-injection`: namespaces de plataforma y `app` con inyección de Istio |
| [03-releases-helm.png](01-entorno-local/03-releases-helm.png) | `helm list -A`: cert-manager, OpenTelemetry Operator, istio-base e istiod con versión fija |
| [04-pods-plataforma.png](01-entorno-local/04-pods-plataforma.png) | `kubectl get pods -A -o wide`: componentes de plataforma en `Running` en sus nodos |

## 02. Aplicación

| Captura | Muestra |
|---|---|
| [01-imagen-docker-hub.png](02-aplicacion/01-imagen-docker-hub.png) | Imagen versionada `edsonmgoz/products-api:v0.1.0` en Docker Hub |

## 03. Gitea y CI

| Captura | Muestra |
|---|---|
| [01-repositorio-gitea.png](03-gitea-ci/01-repositorio-gitea.png) | Repositorio público `acme/products-api` con `.gitea/workflows` y el tag `v0.1.1` |
| [02-action-gitea.png](03-gitea-ci/02-action-gitea.png) | Workflow lanzado por el tag `v0.1.1`: pruebas, build y push en `Success` |
| [03-imagen-docker-hub.png](03-gitea-ci/03-imagen-docker-hub.png) | Imagen `v0.1.1` publicada por ese workflow para `linux/amd64` y `linux/arm64` |

## 04. GitOps

| Captura | Muestra |
|---|---|
| [01-argocd-aplicaciones.png](04-gitops/01-argocd-aplicaciones.png) | `k8s-local-apps` y `products-api` en `Synced` y `Healthy` |
| [02-argocd-products-api.png](04-gitops/02-argocd-products-api.png) | Recursos de `products-api` sincronizados desde Gitea |
| [03-sync-v0.1.1.png](04-gitops/03-sync-v0.1.1.png) | Sincronización automática del commit que cambia la imagen a `v0.1.1` |

## 05. Service mesh

| Captura | Muestra |
|---|---|
| [01-gateway-ingress-public.png](05-service-mesh/01-gateway-ingress-public.png) | Gateway `ingress-public` en `PROGRAMMED` y su pod en el nodo `workloads` |
| [02-recursos-app.png](05-service-mesh/02-recursos-app.png) | Pod `2/2` (aplicación e `istio-proxy`), Service y HTTPRoute en `app` |
| [03-curl-api.png](05-service-mesh/03-curl-api.png) | `curl -i http://localhost/api/products`: `200 OK` con `server: istio-envoy` |
| [04-logs-istio.png](05-service-mesh/04-logs-istio.png) | La misma petición, por su `x-request-id`, en los access logs del gateway y del sidecar |

## 06. Observabilidad

| Captura | Muestra |
|---|---|
| [01-componentes.png](06-observabilidad/01-componentes.png) | Prometheus, collector y Alloy desplegados y en `Running` |
| [02-pod-instrumentado.png](06-observabilidad/02-pod-instrumentado.png) | Pod con el init container `opentelemetry-auto-instrumentation-java` y el agente `2.27.0` en el log |
| [03-prometheus-aplicacion.png](06-observabilidad/03-prometheus-aplicacion.png) | Peticiones por segundo enviadas por el agente de OpenTelemetry durante la prueba de carga |
| [04-prometheus-istio.png](06-observabilidad/04-prometheus-istio.png) | Métricas del sidecar de Istio que usa la card de métricas de Backstage |
| [05-prometheus-trazas.png](06-observabilidad/05-prometheus-trazas.png) | Trazas convertidas en métricas por el conector `spanmetrics` |

## 07. Developer Portal

| Captura | Muestra |
|---|---|
| [01-catalogo.png](07-developer-portal/01-catalogo.png) | Catálogo con `products-api` |
| [02-overview-a.png](07-developer-portal/02-overview-a.png) | Entidad `products-api`: API provista, ficha About y enlaces |
| [02-overview-b.png](07-developer-portal/02-overview-b.png) | Dependencia del namespace `app` y grafo de relaciones |
| [03-card-metrics.png](07-developer-portal/03-card-metrics.png) | Card de métricas: latencia p95 y peticiones por segundo durante la prueba de carga |
| [04-card-gitops-a.png](07-developer-portal/04-card-gitops-a.png) | Card de Argo CD: `products-api` en `Synced` y `Healthy` |
| [04-card-gitops-b.png](07-developer-portal/04-card-gitops-b.png) | Historial de despliegues de Argo CD |
| [05-kubernetes.png](07-developer-portal/05-kubernetes.png) | Pod sin errores ni reinicios, con su uso de CPU y memoria |
| [06-techdocs.png](07-developer-portal/06-techdocs.png) | TechDocs generado desde `docs/` |
| [07-docker-images.png](07-developer-portal/07-docker-images.png) | Etiquetas de la imagen en Docker Hub |

## 08. Políticas

| Captura | Muestra |
|---|---|
| [01-componentes.png](08-politicas/01-componentes.png) | Kyverno y policy-reporter instalados y en `Running` |
| [02-politicas-app.png](08-politicas/02-politicas-app.png) | Las doce políticas del namespace `app` en `Ready` |
| [03-policy-report.png](08-politicas/03-policy-report.png) | 14 resultados en `pass` y ninguno en `fail` |
| [04-rechazo-admision.png](08-politicas/04-rechazo-admision.png) | Kyverno rechaza un tag `latest` y un registro no aprobado (`--dry-run=server`) |
| [05-policy-reporter-ui.png](08-politicas/05-policy-reporter-ui.png) | Resultados del namespace `app` en policy-reporter |
| [06-policy-reporter-ui-kyverno.png](08-politicas/06-policy-reporter-ui-kyverno.png) | Políticas agrupadas por categoría |
