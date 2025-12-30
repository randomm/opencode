# React Pattern Rules

When working with React/TypeScript files (*.tsx, *.jsx, *.ts, *.js):
- Functional components with hooks (no class components)
- TypeScript strict mode, no `any` types allowed
- Jest or Vitest for testing, React Testing Library for components
- Test behavior, not implementation details
- Use proper queries: `getByRole` > `getByText` > `getByTestId`
- Memoization only when measured as necessary
- Keep components focused and small (<100 lines)
- Zero suppressions (@ts-ignore, eslint-disable)
