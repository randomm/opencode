# Rust Safety Rules

When working with Rust files (*.rs):
- std library first, external crates only when necessary
- `cargo clippy -- -D warnings` must pass with zero warnings
- `cargo fmt` required before commits
- Document all `unsafe` blocks with safety justification
- Prefer `&str` over `String`, stack over heap allocation
- Use `Result` and `?` for error propagation
- No `.unwrap()` in production code - use `expect()` with context
- Test coverage minimum 80%
