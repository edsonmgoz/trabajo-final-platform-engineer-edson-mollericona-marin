# Guia para publicar en repo-infra

Este repositorio fue creado por el Golden Path. El Scaffolder crea el repo de la aplicacion y registra el `catalog-info.yaml`, pero no abre una PR hacia `repo-infra`.

## Archivos generados

- `k8s/manifest.yaml`: manifiestos Kubernetes del servicio.
- `k8s/argocd/application.yaml`: Application de ArgoCD para que `repo-infra` despliegue el servicio.

## Uso de rutas

Si el servicio fue creado como `API`, revisa el bloque `HTTPRoute` o `GRPCRoute` dentro de `k8s/manifest.yaml` antes de abrir la PR hacia `repo-infra`.

El Golden Path deja valores base para que el manifiesto funcione sin pedir demasiados parametros en el formulario:

- `gatewayName`: `ingress-public`
- `gatewayNamespace`: `istio-system`
- `routeHost`: vacio, por lo que acepta cualquier host permitido por el Gateway
- `httpPathPrefix`: `/`
- `servicePort`: `8080`

Para HTTP, ajusta el `PathPrefix` si el servicio debe publicarse en una ruta propia.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
spec:
  parentRefs:
    - name: ingress-public
      namespace: istio-system
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /${{ values.serviceName }}
      backendRefs:
        - name: ${{ values.serviceName }}
          port: 8080
```

Si necesitas limitar el host, agrega `hostnames`.

```yaml
spec:
  hostnames:
    - ${{ values.serviceName }}.local
```

Para gRPC, no se usa `PathPrefix`; valida que exista `GRPCRoute`, que apunte al mismo Gateway y que el `backendRefs.port` coincida con el puerto del `Service`.

## PR manual hacia repo-infra

1. Crea una rama en `repo-infra`.

```bash
git checkout -b feat/${{ values.serviceName }}-gitops
```

2. Copia el manifest Kubernetes.

```bash
cp ../${{ values.repoName }}/k8s/manifest.yaml manifests/${{ values.serviceName }}.yaml
```

3. Copia el Application de ArgoCD.

```bash
cp ../${{ values.repoName }}/k8s/argocd/application.yaml clusters/local/apps/project-online-boutique/${{ values.serviceName }}.yaml
```

4. Revisa estos campos antes de abrir la PR.

- `spec.source.repoURL`: debe apuntar a `repo-infra`.
- `spec.source.path`: debe ser `manifests`.
- `spec.source.directory.include`: debe ser `${{ values.serviceName }}.yaml`.
- `spec.destination.namespace`: debe ser el namespace donde se desplegara el servicio.
- Si es API HTTP, revisa el `HTTPRoute.spec.rules[].matches[].path.value`.
- Si es API gRPC, revisa el `GRPCRoute.spec.parentRefs` y `backendRefs.port`.

5. Crea el commit y abre la PR.

```bash
git add manifests/${{ values.serviceName }}.yaml clusters/local/apps/project-online-boutique/${{ values.serviceName }}.yaml
git commit -m "feat: deploy ${{ values.serviceName }}"
git push origin feat/${{ values.serviceName }}-gitops
```

La PR debe ser revisada y aprobada en Gitea. ArgoCD sincronizara el servicio cuando el cambio llegue a `main` en `repo-infra`.
