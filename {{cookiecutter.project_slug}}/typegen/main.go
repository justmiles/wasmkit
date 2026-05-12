package main

import (
	"log"
	"os"

	"github.com/coder/guts"
	"github.com/coder/guts/config"
)

func main() {
	golang, err := guts.NewGolangParser()
	if err != nil {
		log.Fatal("failed to create parser:", err)
	}

	if err := golang.IncludeGenerate("{{ cookiecutter.go_module }}/wasm/apitypes"); err != nil {
		log.Fatal("failed to include package:", err)
	}

	if err := golang.IncludeCustom(map[string]string{
		"time.Time": "string",
	}); err != nil {
		log.Fatal("failed to include custom mappings:", err)
	}
	golang.IncludeCustomDeclaration(config.StandardMappings())

	ts, err := golang.ToTypescript()
	if err != nil {
		log.Fatal("failed to convert to typescript:", err)
	}

	ts.ApplyMutations(
		config.ExportTypes,
		config.EnumAsTypes,
	)

	output, err := ts.Serialize()
	if err != nil {
		log.Fatal("failed to serialize:", err)
	}

	if err := os.WriteFile("../web/src/lib/types.gen.ts", []byte(output), 0644); err != nil {
		log.Fatal("failed to write output:", err)
	}
}
