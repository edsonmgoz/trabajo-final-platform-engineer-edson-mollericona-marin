# platform-gitea

Frontend plugin interno para visualizar informacion de Gitea en entidades de Backstage.

## Responsabilidad

Este plugin muestra informacion y acciones controladas:

- lista Pull Requests
- muestra detalle de Pull Requests
- permite `Approve` y `Request change` con motivo cuando `actionsEnabled: true`
- lista workflow runs de Gitea Actions y su estado

Las llamadas se hacen contra el backend plugin:

```txt
/api/platform-gitea
```

## Requisitos

El backend `@internal/plugin-platform-gitea-backend` debe estar registrado.

Las entidades deben tener una de estas annotations:

```yaml
gitea.com/project-slug: root/frontend
```

o:

```yaml
backstage.io/source-location: url:http://gitea:3000/root/frontend/src/branch/main/
```
