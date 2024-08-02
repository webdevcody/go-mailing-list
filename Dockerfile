FROM golang:1.22.5-bullseye AS builder
WORKDIR /app
RUN apt-get update -qq && \
	apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3 upx

RUN curl -fsSL https://deb.nodesource.com/setup_current.x | bash - && \
	apt-get install -y nodejs \
	build-essential && \
	node --version && \ 
	npm --version

# install zig toolchain
RUN wget https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz && \
	tar -xf zig-linux-x86_64-0.13.0.tar.xz && \
	mv zig-linux-x86_64-0.13.0 /usr/local/zig && \
	rm zig-linux-x86_64-0.13.0.tar.xz && \
	ln -s /usr/local/zig/zig /usr/local/bin/zig && \
	zig version

RUN apt-get install -y --no-install-recommends ca-certificates


RUN go install github.com/a-h/templ/cmd/templ@latest

COPY go.mod go.sum package-lock.json package.json ./
RUN npm ci
RUN go version
RUN go mod tidy
COPY . .
RUN make -f tiny-bundle.mk build

FROM scratch
WORKDIR /app
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/bin .
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD [ "/app/app_prod" ]
