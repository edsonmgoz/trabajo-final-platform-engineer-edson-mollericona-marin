# platform-docker

Frontend plugin interno para listar tags de Docker Hub en entidades de Backstage.

## Responsabilidad

Este plugin agrega un tab `Images` a entidades `Component` y lista los tags de
la imagen configurada en el catalogo.

Usa el proxy de Backstage, no llama Docker Hub directamente desde el navegador.

## Requisitos

La app debe tener registrado el backend proxy:

```ts
backend.add(import("@backstage/plugin-proxy-backend"));
```

Configurar `app-config.yaml`:

```yaml
proxy:
  endpoints:
    "/docker":
      target: "https://hub.docker.com"
      changeOrigin: true
      # headers:
      #   Authorization: ${DOCKER_TOKEN}
```

La entidad debe tener esta annotation:

```yaml
metadata:
  annotations:
    docker.com/repository: grafana/grafana
```

Para imagenes oficiales de Docker Hub tambien se puede usar:

```yaml
metadata:
  annotations:
    docker.com/repository: nginx
```

El plugin lo normaliza como `library/nginx`.

## Integracion

Copiar este proyecto a:

```txt
<backstage-app>/plugins/platform-docker/
```

Importar en `packages/app/src/App.tsx`:

```ts
import dockerPlugin from "@internal/plugin-platform-docker";
```

Agregarlo en `features`:

```ts
export default createApp({
  features: [dockerPlugin],
});
```

Si la app no detecta plugins desde `plugins/*`, verificar los workspaces:

```json
{
  "workspaces": ["packages/*", "plugins/*"]
}
```
