FROM eclipse-temurin:25-jdk-noble AS builder

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies

COPY src src
RUN ./gradlew --no-daemon bootJar

FROM eclipse-temurin:25-jre-alpine

RUN addgroup -S -g 1000 app && adduser -S -u 1000 -G app app

WORKDIR /app
COPY --from=builder /workspace/build/libs/*.jar app.jar

USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
