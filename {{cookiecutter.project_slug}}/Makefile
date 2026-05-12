.PHONY: all build wasm typegen dev clean lint

WASM_OUT = web/public/main.wasm
WASM_EXEC = web/public/wasm_exec.js

all: build

# Build everything: WASM binary, types, and frontend
build: wasm typegen
	cd web && npm run build

# Compile Go to WASM
wasm:
	cd wasm && GOOS=js GOARCH=wasm go build -o ../$(WASM_OUT) .
	cp -f "$$(go env GOROOT)/lib/wasm/wasm_exec.js" $(WASM_EXEC)
	chmod u+w $(WASM_EXEC)

# Generate TypeScript types from Go structs
typegen:
	cd typegen && go run .

# Run the Vite dev server (build WASM first)
dev: wasm typegen
	cd web && npm run dev

# Watch Go files and rebuild WASM + types on change
watch:
	@echo "Watching wasm/ for changes..."
	@while true; do \
		inotifywait -r -e modify,create,delete wasm/ 2>/dev/null || fswatch -1 wasm/; \
		$(MAKE) wasm typegen; \
	done

# Run linters (Go + TypeScript)
lint:
	GOOS=js GOARCH=wasm golangci-lint run ./wasm/...
	cd web && npx eslint .

# Remove build artifacts
clean:
	rm -f $(WASM_OUT) $(WASM_EXEC) web/src/lib/types.gen.ts
	cd web && rm -rf dist

# Install dependencies
deps:
	cd wasm && go mod tidy
	cd typegen && go mod tidy
	cd web && npm install
