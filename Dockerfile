FROM golang:1.22.5-bullseye as base

# Build Layer
FROM base AS builder
WORKDIR /app
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3 

    RUN curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && \
    apt-get install -y nodejs \
    build-essential && \
    node --version && \ 
    npm --version

RUN go install github.com/a-h/templ/cmd/templ@latest

COPY go.mod go.sum package-lock.json package.json ./
RUN npm ci
RUN go version
RUN go mod tidy
COPY . .
RUN make build

FROM scratch
WORKDIR /app
COPY --from=builder /app/bin .
COPY --from=builder /app/public ./public
ARG DATABASE_URL
ARG HTTP_LISTEN_ADDR
EXPOSE 3000
CMD [ "/app/app_prod" ]