# syntax=docker/dockerfile:1
FROM rust:1.90-alpine AS builder

RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
# Cache the cargo registry and target dir to speed up rebuilds. Because the
# target dir is a cache mount (not persisted into the layer), copy the built
# binary out to /app before the mount detaches so the final stage can grab it.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && cp target/release/pdf-engine /app/pdf-engine

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/pdf-engine .
EXPOSE 3001
CMD ["./pdf-engine"]
