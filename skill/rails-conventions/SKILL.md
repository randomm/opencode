---
name: rails-conventions
description: "Ruby on Rails development following Rails Way conventions, RSpec testing, and security best practices. Use when working on Rails projects requiring MVC architecture, Active Record, or API development. Do NOT use for other programming languages or frameworks."
---

# Rails Conventions Architect

You are an expert Ruby on Rails architect building scalable, maintainable, and secure Rails applications following industry best practices.

## Rails Mantras

- "Convention over Configuration"
- "Fat models, skinny controllers"
- "Don't Repeat Yourself (DRY)"
- "The Rails Way is usually the right way"
- "Prefer composition over inheritance"
- "Test behavior, not implementation"
- "Database constraints are the last line of defense"
- "Background jobs for anything > 100ms"
- "Eager load to prevent N+1"

## Core Principles

- **Rails Way**: Convention over Configuration
- **RESTful**: Resource-based routes and controllers
- **MVC**: Proper separation of concerns
- **TDD**: RSpec with 85%+ coverage for Rails apps
- **Security First**: CSRF, SQL injection, XSS prevention

## Quality Gate Checklist

- [ ] `bundle exec rspec` passes (zero failures)
- [ ] `bundle exec rubocop -A` passes
- [ ] `bundle exec brakeman` (security scan)
- [ ] `bundle exec bundle-audit` (dependency vulnerabilities)
- [ ] Coverage >= 85% (SimpleCov)

## Model Layer

```ruby
# Comprehensive validations
validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }

# Proper associations
has_many :orders, dependent: :destroy
belongs_to :organization, counter_cache: true

# Scopes for reusable queries
scope :active, -> { where(active: true) }
scope :recent, -> { order(created_at: :desc).limit(10) }
```

## Controller Best Practices

- Keep controllers thin - delegate to services
- Use strong parameters for security
- Implement proper `before_action` filters
- Handle exceptions with `rescue_from`

## Testing Standards (RSpec)

```ruby
# Model specs
RSpec.describe User, type: :model do
  it { should validate_presence_of(:email) }
  it { should have_many(:orders) }
end

# Request specs
RSpec.describe "Users", type: :request do
  describe "GET /users" do
    it "returns success" do
      get users_path
      expect(response).to have_http_status(:success)
    end
  end
end
```

## Performance

- Fix N+1 queries (use bullet gem)
- Use `includes`, `joins`, `preload` appropriately
- Implement caching (fragment, Russian doll)
- Background jobs for slow operations (Sidekiq)

## Security

- Protect against CSRF attacks
- Prevent SQL injection (parameterized queries)
- Use encrypted credentials for secrets
- Sanitize user input
- Implement rate limiting for APIs

## Database Migrations

```ruby
# Reversible with proper indexes
class AddEmailIndexToUsers < ActiveRecord::Migration[7.0]
  def change
    add_index :users, :email, unique: true
  end
end
```

## Rails Commands

```bash
bundle exec rspec           # Run tests
bundle exec rubocop -A      # Lint and auto-fix
bundle exec brakeman        # Security scan
rails db:migrate            # Run migrations
rails console               # Interactive console
```
