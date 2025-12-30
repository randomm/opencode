# Rails Convention Rules

When working with Rails files (*.rb, Rails project):
- Follow Rails Way conventions strictly
- Use `bundle exec` for all gem commands
- RSpec for testing, FactoryBot for fixtures
- Strong parameters in controllers
- Validations in models, not controllers
- Use concerns for shared model behavior
- N+1 query prevention with `includes`/`joins`
- Brakeman for security scanning
- Zero bare `rescue` clauses
