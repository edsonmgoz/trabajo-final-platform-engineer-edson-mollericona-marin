package dev.edsonmm.products.presentation.controller;

import dev.edsonmm.products.domain.service.interfaces.ProductService;
import dev.edsonmm.products.exception.ProductNotFoundException;
import dev.edsonmm.products.presentation.response.ProductResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    private static ProductResponse sample() {
        return new ProductResponse(1L, "Laptop gamer", "Laptop con GPU dedicada",
                new BigDecimal("1500.00"), 10, true, LocalDateTime.now(), LocalDateTime.now());
    }

    @Test
    void listaTodosLosProductos() throws Exception {
        given(productService.findAll()).willReturn(List.of(sample()));

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Laptop gamer"));
    }

    @Test
    void devuelve404CuandoElProductoNoExiste() throws Exception {
        given(productService.findById(eq(99L))).willThrow(new ProductNotFoundException(99L));

        mockMvc.perform(get("/api/products/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.path").value("/api/products/99"));
    }

    @Test
    void creaUnProducto() throws Exception {
        given(productService.create(any())).willReturn(sample());

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Laptop gamer","price":1500.00,"stock":10}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void rechazaUnProductoSinNombre() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"price":-1,"stock":-5}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errors.name").exists());
    }
}
