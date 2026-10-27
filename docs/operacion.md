# Operación

## Publicar un cambio

Los cambios en `k8s/` y `gitops/` llegan al cluster solo a través de Git. El commit se publica en los dos remotes:

```bash
git push origin master
git push gitea master
```

Argo CD consulta el repositorio cada 180 segundos, con hasta 60 segundos de variación, y sincroniza la Application `products-api` sin intervención manual. Los cambios aplicados a mano sobre el cluster se revierten.

Una versión nueva de la imagen se publica creando el tag `vX.Y.Z` y empujándolo a Gitea; después se actualiza la etiqueta de imagen en `k8s/products-api.yaml`.

## Comprobaciones

```bash
kubectl -n argocd get applications
kubectl -n app get pods,svc,httproute -o wide
curl -i http://localhost/api/products
kubectl get policyreport -n app
```

| Comprobación | Resultado esperado |
|---|---|
| Applications de Argo CD | `k8s-local-apps` y `products-api` en `Synced` y `Healthy` |
| Pod de products-api | `2/2` contenedores listos: `server` e `istio-proxy` |
| Petición al gateway | `HTTP/1.1 200` con la cabecera `server: istio-envoy` |
| Informes de Kyverno | 14 resultados en `pass` y ninguno en `fail` |

## Generar tráfico

Las métricas de la pestaña Metrics de Backstage se calculan sobre ventanas de cinco minutos. Para que tengan datos se genera carga contra el gateway:

```bash
siege -c 15 -t 60S http://localhost/api/products
```

## Limitaciones

- La base H2 se reinicia con el pod: los productos creados o modificados se pierden y vuelven los cinco iniciales.
- El servicio no escala horizontalmente mientras use H2 en memoria.
- Actuator y Swagger UI no se publican en el gateway; se consultan desde dentro del cluster.
