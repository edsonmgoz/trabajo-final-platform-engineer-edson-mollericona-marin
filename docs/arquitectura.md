# Arquitectura

products-api se ejecuta en un cluster k3d local (k3s v1.35.5, un nodo de control y dos agentes). El servicio se programa en el nodo `workloads`, como exige la política `require-workloads-node-selector`, y la mayoría de componentes de plataforma, en el nodo `system`.

## Flujo de entrega

```
commit ──> GitHub (origin)
       └─> Gitea acme/products-api ──> Gitea Actions: pruebas y build multiarquitectura ──> Docker Hub edsonmgoz/products-api
                                   └─> Argo CD: sincroniza k8s/ en el namespace app
```

El repositorio se publica en GitHub y en Gitea. Gitea Actions ejecuta las pruebas y construye la imagen para linux/amd64 y linux/arm64. Un tag `vX.Y.Z` genera la etiqueta de imagen `vX.Y.Z` y un commit en `master`, la etiqueta `master-<sha>`; nunca se publica `latest`. Argo CD lee la carpeta `k8s/` de la rama `master` en Gitea y la aplica con sincronización automática, `prune` y `selfHeal`.

## Componentes

| Componente | Namespace | Versión | Función |
|---|---|---|---|
| Istio (sidecar) | `istio-system` | 1.29.2 | Gateway `ingress-public` y mTLS entre servicios |
| Gitea y act_runner | Docker Compose | 1.26.2 y 0.6.1 | Repositorio Git y CI |
| Argo CD | `argocd` | 3.3.9 | Despliegue GitOps (app of apps) |
| OpenTelemetry Operator | `operators` | 0.159.0 | Inyección del agente Java 2.27.0 |
| Collector `otel` | `o11y` | 0.159.0 | Recepción OTLP y escritura en Prometheus |
| Prometheus | `prometheus` | 3.11.3 | Almacenamiento de métricas |
| k8s-monitoring (Alloy) | `grafana-agent` | 4.0.3 | Métricas y logs del cluster |
| Kyverno | `kyverno` | 1.18.0 | Doce políticas en modo `Enforce` sobre `app` |
| policy-reporter | `policy-reporter` | 3.7.4 | Informes de cumplimiento |
| Backstage | local (`yarn start`) | 1.54.0 | Catálogo, TechDocs e integraciones |

## Recorrido de una petición

```
cliente ──> localhost:80 ──> Gateway ingress-public (istio-system)
        ──> HTTPRoute /api/products ──> Service products-api:8080 ──> sidecar istio-proxy ──> contenedor server
```

El tráfico entre el gateway y el sidecar viaja cifrado con mTLS. El gateway y los sidecars envían trazas por OTLP al collector, y Prometheus guarda las métricas de Istio que usa la pestaña Metrics de Backstage: latencia p95, peticiones por segundo y errores por código de respuesta.

## Recursos del servicio

| Recurso | Configuración |
|---|---|
| Namespace `app` | Etiqueta `istio-injection=enabled` |
| ServiceAccount `products-api` | Sin montaje automático del token |
| Deployment `products-api` | Una réplica, usuario 1000, sin escalada de privilegios, sistema de archivos raíz de solo lectura, requests de 100m de CPU y 512Mi de memoria, límites de 1 CPU y 512Mi, sondas de readiness y liveness |
| Service `products-api` | ClusterIP en el puerto 8080 |
| HTTPRoute `products-api-route` | Prefijo `/api/products` del Gateway `ingress-public` |

El servicio corre con una sola réplica porque la base H2 vive en la memoria de cada pod: varias réplicas tendrían datos distintos.
