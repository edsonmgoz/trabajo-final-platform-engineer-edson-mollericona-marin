package dev.edsonmm.products.exception.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

@Schema(description = "Errores de validacion por campo")
public record ValidationErrorResponse(

        @Schema(description = "Codigo HTTP", example = "400")
        int status,

        @Schema(description = "Mensaje de error por campo")
        Map<String, String> errors
) {
}
