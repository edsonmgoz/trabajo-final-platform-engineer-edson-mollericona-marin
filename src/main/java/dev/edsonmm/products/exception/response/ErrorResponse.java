package dev.edsonmm.products.exception.response;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Error devuelto por la API")
public record ErrorResponse(

        @Schema(description = "Codigo HTTP", example = "404")
        int status,

        @Schema(description = "Detalle del error", example = "No se encontro el producto con id 99")
        String message,

        @Schema(description = "Ruta solicitada", example = "/api/products/99")
        String path
) {
}
