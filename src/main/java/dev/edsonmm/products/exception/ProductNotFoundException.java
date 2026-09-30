package dev.edsonmm.products.exception;

public class ProductNotFoundException extends RuntimeException {

    public ProductNotFoundException(Long id) {
        super("No se encontro el producto con id %d".formatted(id));
    }
}
