ARG BUILDPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM maven:3.9.9-eclipse-temurin-21 AS builder

WORKDIR /workspace

COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=builder /workspace/target/${{ values.serviceName }}-0.1.0.jar /app/app.jar

EXPOSE ${{ values.servicePort }}
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
