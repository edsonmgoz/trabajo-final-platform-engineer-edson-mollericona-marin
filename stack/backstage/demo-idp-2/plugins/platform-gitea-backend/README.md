# platform-gitea-backend

Backend plugin interno para operaciones de Gitea usadas por Backstage.

## Responsabilidad

Este plugin concentra acciones de Git que no deben ejecutarse desde el frontend:

- listar Pull Requests
- ver detalle de Pull Requests
- crear Pull Requests
- aprobar Pull Requests usando review `APPROVED`
- hacer merge de Pull Requests con validaciones
- pedir cambios en Pull Requests usando review `REQUEST_CHANGES`
- listar workflow runs de Gitea Actions
- crear PR GitOps para bootstrap o canary
- crear PR de alta en `backstage/catalog/index.yaml` desde Scaffolder

Tambien registra la accion Scaffolder `platform-gitea:create-catalog-index-pr`
para que el Golden Path no registre entidades directo en la BD de Backstage.

## Ruta API

Cuando se registra en Backstage queda disponible en:

```txt
/api/platform-gitea
```

Endpoints principales:

```txt
GET  /health
GET  /repos/:owner/:repo/pulls
GET  /repos/:owner/:repo/pulls/:index
GET  /repos/:owner/:repo/actions/runs
POST /repos/:owner/:repo/pulls
POST /repos/:owner/:repo/pulls/:index/approve
POST /repos/:owner/:repo/pulls/:index/merge
POST /repos/:owner/:repo/pulls/:index/request-changes
POST /gitops/bootstrap-project
POST /gitops/canary
```

## Configuracion

En `backstage.appConfig`:

```yaml
platformGitea:
  mockMode: true
  actionsEnabled: false
  gitea:
    baseUrl: ${GITEA_BASE_URL}
    token: ${GITEA_TOKEN}
  gitops:
    owner: root
    repo: repo-infra
    baseBranch: main
    catalogIndexPath: backstage/catalog/index.yaml
```

`actionsEnabled: false` deja el plugin en modo lectura. Para habilitar acciones
reales como crear PRs, approve, merge o request changes, cambiarlo a `true` y
configurar un `GITEA_TOKEN` con permisos sobre los repositorios.

Para la accion `platform-gitea:create-catalog-index-pr`, el token necesita
`write:repository` sobre el repo configurado en `platformGitea.gitops`.

Si la version de Gitea no expone `/api/v1/repos/:owner/:repo/actions/runs`, el
plugin devuelve una lista vacia de workflow runs para no bloquear la carga de
Pull Requests.

El backend tambien normaliza Pull Requests antiguos/nativos de Gitea que usan
`number` en vez de `index`, porque el frontend usa `index` para abrir detalles y
ejecutar acciones.

Las acciones `approve` y `request changes` se firman en Gitea con el usuario dueño del
`GITEA_TOKEN`. Para auditoria, el cuerpo de la review agrega el usuario
Backstage de la sesion actual. El backend consulta las reviews existentes para
evitar aprobar o pedir cambios mas de una vez sobre el mismo Pull Request.

## Integracion en una app existente

Copiar este proyecto a:

```txt
<backstage-app>/plugins/platform-gitea-backend/
```

Registrar en `packages/backend/src/index.ts`:

```ts
backend.add(import('@internal/plugin-platform-gitea-backend'));
```

Agregarlo a los workspaces del monorepo si la app no lo detecta automaticamente:

```json
{
  "workspaces": {
    "packages": ["packages/*", "plugins/*"]
  }
}
```

Luego reconstruir la imagen Backstage.
