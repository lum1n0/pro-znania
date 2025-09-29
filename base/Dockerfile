FROM openjdk:17-jdk-slim AS builder

WORKDIR /app

COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts .
COPY settings.gradle.kts .
COPY src src

RUN chmod +x gradlew
RUN ./gradlew bootJar -x test

FROM openjdk:17-jdk-slim

ENV TZ=Europe/Moscow
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && rm -rf /var/lib/apt/lists/*

ENV JAVA_CACERTS=/usr/local/openjdk-17/lib/security/cacerts
ENV JAVA_OPTS="-Djavax.net.ssl.trustStore=/usr/local/openjdk-17/lib/security/cacerts -Djavax.net.ssl.trustStorePassword=changeit"

WORKDIR /app


COPY ROOT.crt /tmp/root.crt
COPY ISS.crt /tmp/iss.crt
RUN keytool -importcert -alias "tagras-rootca" -file /tmp/root.crt -keystore "$JAVA_CACERTS" -storepass changeit -noprompt && keytool -importcert -alias "tagras-intermediate" -file /tmp/iss.crt -keystore "$JAVA_CACERTS" -storepass changeit -noprompt && rm /tmp/root.crt /tmp/iss.crt
COPY --from=builder /app/build/libs/*.jar /app/app.jar

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dspring.profiles.active=prod -jar /app/app.jar"]

