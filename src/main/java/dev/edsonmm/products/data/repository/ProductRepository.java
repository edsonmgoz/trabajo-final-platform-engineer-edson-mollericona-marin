package dev.edsonmm.products.data.repository;

import dev.edsonmm.products.domain.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
}
