ifneq (,$(wildcard ./.env))
    include .env
    export
endif

MAIN_PATH = tmp/bin/main
SYNC_ASSETS_COMMAND =	@go run github.com/cosmtrek/air@v1.51.0 \
	--build.cmd "templ generate --notify-proxy" \
	--build.bin "true" \
	--build.delay "100" \
	--build.exclude_dir "" \
	--build.include_dir "public" \
	--build.include_ext "js,css" \
	--screen.clear_on_rebuild true \
	--log.main_only true

templ:
	@templ generate --watch --proxy="http://localhost$(HTTP_LISTEN_ADDR)" --open-browser=false

server:
	@go run github.com/cosmtrek/air@v1.51.0 \
	--build.cmd "go build --tags dev -o ${MAIN_PATH} ./cmd/app/" \
	--build.bin "${MAIN_PATH}" --build.delay "100" \
	--build.exclude_dir "node_modules" \
	--build.include_ext "go" \
	--build.stop_on_error "false" \
	--misc.clean_on_exit true \
	--screen.clear_on_rebuild true \
	--log.main_only true

tailwind:
	@npm run tailwind

sync_assets:
	${SYNC_ASSETS_COMMAND}

target=x86_64-linux-musl
export CC=zig cc -target $(target)
export CXX=zig c++ -target $(target)
export CGO_ENABLED=1
TAGS='static,osuergo,netgo'
EXTLDFLAGS="-static -Oz -s"
LDFLAGS='-linkmode=external -extldflags $(EXTLDFLAGS)'
build:
	@npm run build:tailwind
	@templ generate
	@go build -tags $(TAGS) -ldflags $(LDFLAGS) -o bin/app_prod cmd/app/main.go
	@upx bin/app_prod
	@echo "compiled you application with all its assets to a single binary => bin/app_prod"

dev:
	@make -j4 templ server tailwind sync_assets
	
