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
