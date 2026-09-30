package dev.edsonmm.products.presentation.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@Schema(description = "Datos para crear o actualizar un producto")
public class ProductRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(min = 2, max = 100, message = "El nombre debe tener entre 2 y 100 caracteres")
    @Schema(description = "Nombre del producto", example = "Laptop gamer")
    private String name;

    @Size(max = 500, message = "La descripcion no puede superar los 500 caracteres")
    @Schema(description = "Descripcion opcional", example = "Laptop con GPU dedicada")
    private String description;

    @NotNull(message = "El precio es obligatorio")
    @DecimalMin(value = "0.0", message = "El precio debe ser mayor o igual a cero")
    @Schema(description = "Precio unitario", example = "1500.00")
    private BigDecimal price;

    @NotNull(message = "El stock es obligatorio")
    @Min(value = 0, message = "El stock debe ser mayor o igual a cero")
    @Schema(description = "Unidades disponibles", example = "10")
    private Integer stock;

    @Schema(description = "Si el producto esta activo", example = "true")
    private boolean active = true;
}
