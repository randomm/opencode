# Go Idiom Rules

When working with Go files (*.go):
- Standard library first, minimize external dependencies
- `gofmt` is mandatory, `golangci-lint` recommended
- Table-driven tests with `t.Run()` subtests
- Small interfaces (1-3 methods ideal)
- Accept interfaces, return structs
- Errors are values - handle explicitly with `fmt.Errorf("context: %w", err)`
- Context as first parameter for cancellation
- Make zero values useful and safe
