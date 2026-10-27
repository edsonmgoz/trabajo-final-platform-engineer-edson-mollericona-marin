package platform.goldenpath;

import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class App {

  public static void main(String[] args) {
    SpringApplication app = new SpringApplication(App.class);
    app.setDefaultProperties(Map.of("server.port", env("PORT", "${{ values.servicePort }}")));
    app.run(args);
  }

  @Bean
  CommandLineRunner logStartup(
      @Value("${SERVICE_NAME:${{ values.serviceName }}}") String serviceName,
      @Value("${SERVICE_TYPE:${{ values.serviceType }}}") String serviceType,
      @Value("${TRANSPORT:${{ values.receiveTraffic }}}") String transport) {
    return args ->
        System.out.printf(
            "%s started as %s with transport=%s at %s%n",
            serviceName, serviceType, transport, Instant.now());
  }

  private static String env(String name, String defaultValue) {
    String value = System.getenv(name);
    return value == null || value.isBlank() ? defaultValue : value;
  }
}

@RestController
class ServiceController {

  private final String serviceName;
  private final String serviceType;

  ServiceController(
      @Value("${SERVICE_NAME:${{ values.serviceName }}}") String serviceName,
      @Value("${SERVICE_TYPE:${{ values.serviceType }}}") String serviceType) {
    this.serviceName = serviceName;
    this.serviceType = serviceType;
  }

  @GetMapping("/")
  Map<String, String> home() {
    return Map.of("service", serviceName, "type", serviceType, "status", "ok");
  }

  @GetMapping("/healthz")
  Map<String, String> health() {
    return Map.of("status", "ok");
  }
}
