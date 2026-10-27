# ${{ values.serviceName }}

${{ values.description }}

Servicio Java 21 con Spring Boot generado desde el Golden Path de Backstage.

## Ejecutar

```bash
mvn test
mvn package
java -jar target/${{ values.serviceName }}-0.1.0.jar
```

## Docker

```bash
docker build -t docker.io/${{ values.dockerNamespace }}/${{ values.serviceName }}:local .
```

## Kubernetes

Los manifests base estan en:

```text
k8s/manifest.yaml
k8s/argocd/application.yaml
```

El Scaffolder no abre una PR hacia `repo-infra`. Sigue los pasos de `guia.md` para copiar estos archivos y abrir la PR manualmente.
