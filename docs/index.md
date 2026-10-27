# products-api

Servicio REST que gestiona un catálogo de productos. Está desarrollado con Java 25 y Spring Boot 4.1.1 y guarda los datos en una base H2 en memoria que arranca con cinco productos.

El código fuente está en la carpeta `src/` de la raíz del repositorio, organizado en capas:

```
dev.edsonmm.products
├── presentation    controlador REST, request y response
├── domain          entidad, mapper y servicio
├── data            repositorio JPA
├── exception       excepciones y manejador global
└── config          configuración de OpenAPI
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/products` | Lista todos los productos |
| GET | `/api/products/{id}` | Obtiene un producto |
| POST | `/api/products` | Crea un producto |
| PUT | `/api/products/{id}` | Actualiza un producto |
| DELETE | `/api/products/{id}` | Elimina un producto |

El gateway de Istio publica solo el prefijo `/api/products` en `http://localhost`. La especificación OpenAPI (`/api-docs`), Swagger UI y Actuator quedan accesibles únicamente dentro del cluster. La especificación incluida en `docs/openapi.yaml` se obtuvo del servicio desplegado y es la que muestra la entidad API del catálogo.

## Entidades del catálogo

`catalog-info.yaml`, en la raíz del repositorio, registra en Backstage las siguientes entidades:

| Tipo | Nombre | Relación |
|---|---|---|
| Component | `products-api` | Servicio desplegado en el namespace `app` |
| API | `products-api-http-api` | API OpenAPI que provee `products-api` |
| System | `products` | Agrupa el servicio, su API y su namespace |
| Group | `team-products` | Propietario de todas las entidades |
| Resource | `app-namespace` | Namespace del que depende `products-api` |

Las anotaciones del componente enlazan cada pestaña del portal con su origen:

| Anotación | Valor | Uso |
|---|---|---|
| `backstage.io/kubernetes-id` | `products-api` | Recursos de Kubernetes con esa etiqueta |
| `backstage.io/kubernetes-namespace` | `app` | Namespace de los recursos y de las consultas de CPU en Prometheus |
| `argocd/app-name` | `products-api` | Application de Argo CD |
| `gitea.com/project-slug` | `acme/products-api` | Repositorio y ejecuciones de Gitea Actions |
| `docker.com/repository` | `edsonmgoz/products-api` | Etiquetas de la imagen en Docker Hub |
| `backstage.io/techdocs-ref` | `dir:.` | Esta documentación |
