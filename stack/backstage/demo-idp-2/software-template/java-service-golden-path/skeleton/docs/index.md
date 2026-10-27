# ${{ values.serviceName }}

${{ values.description }}

## Golden Path

Este servicio fue creado desde el Golden Path Java 21 con Spring Boot.

- Tipo: `${{ values.serviceType }}`
- Entrada: `${{ values.receiveTraffic }}`
- Imagen: `docker.io/${{ values.dockerNamespace }}/${{ values.serviceName }}`
- Kubernetes id: `${{ values.serviceName }}`

## Desarrollo local

```bash
mvn test
mvn package
java -jar target/${{ values.serviceName }}-0.1.0.jar
```

## Plataforma

El repositorio incluye:

- `catalog-info.yaml` para Backstage.
- `docs/` y `mkdocs.yml` para TechDocs.
- `.gitea/workflows/java-docker-buildx.yaml` para CI.
- `Dockerfile` para construir la imagen.
- `k8s/manifest.yaml` con Deployment, ServiceAccount, Service y rutas Gateway API cuando aplica.
- `k8s/argocd/application.yaml` como plantilla de Application para `repo-infra`.
- `guia.md` con los pasos para abrir la PR manual hacia `repo-infra`.
