package dev.edsonmm.products.domain.service.interfaces;

import dev.edsonmm.products.presentation.request.ProductRequest;
import dev.edsonmm.products.presentation.response.ProductResponse;

import java.util.List;

public interface ProductService {

    List<ProductResponse> findAll();

    ProductResponse findById(Long id);

    ProductResponse create(ProductRequest request);

    ProductResponse update(Long id, ProductRequest request);

    void delete(Long id);
}
