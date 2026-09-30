package dev.edsonmm.products.domain.service.implement;

import dev.edsonmm.products.data.repository.ProductRepository;
import dev.edsonmm.products.domain.entity.Product;
import dev.edsonmm.products.domain.mapper.ProductMapper;
import dev.edsonmm.products.domain.service.interfaces.ProductService;
import dev.edsonmm.products.exception.ProductNotFoundException;
import dev.edsonmm.products.presentation.request.ProductRequest;
import dev.edsonmm.products.presentation.response.ProductResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponse> findAll() {
        return productRepository.findAll()
                .stream()
                .map(productMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse findById(Long id) {
        return productMapper.toResponse(findOrThrow(id));
    }

    @Override
    @Transactional
    public ProductResponse create(ProductRequest request) {
        Product saved = productRepository.save(productMapper.toEntity(request));
        return productMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = findOrThrow(id);
        productMapper.updateEntity(request, product);
        return productMapper.toResponse(productRepository.saveAndFlush(product));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        productRepository.delete(findOrThrow(id));
    }

    private Product findOrThrow(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }
}
