# products-api

Servicio REST de productos desarrollado como trabajo final del curso Cloud Native Platform Engineer.

## Stack

| Componente | Versión |
|---|---|
| Java | 25 (LTS) |
| Spring Boot | 4.1.1 |
| Gradle | 9.7.1 mediante wrapper |
| Base de datos | H2 en memoria |
| Documentación de API | springdoc-openapi 3.1.0 |

## Ejecución

```bash
./gradlew bootRun
```

El servicio queda escuchando en `http://localhost:8080` con cinco productos ya cargados.

Para compilar y ejecutar las pruebas:

```bash
./gradlew build
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/products` | Lista todos los productos |
| GET | `/api/products/{id}` | Obtiene un producto |
| POST | `/api/products` | Crea un producto |
| PUT | `/api/products/{id}` | Actualiza un producto |
| DELETE | `/api/products/{id}` | Elimina un producto |

Documentación interactiva en `http://localhost:8080/swagger-ui.html` y especificación OpenAPI en `http://localhost:8080/api-docs`.

El estado del servicio se consulta en `http://localhost:8080/actuator/health`.

## Estructura

El código sigue una separación en capas:

```
dev.edsonmm.products
├── presentation    controlador REST, request y response
├── domain          entidad, mapper y servicio
├── data            repositorio JPA
├── exception       excepciones y manejador global
└── config          configuración de OpenAPI
```
