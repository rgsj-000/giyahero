# GiyaHero 01 Foundation and Delivery Implementation Plan

**Goal:** Establish the production application, database, test, environment, CI/CD, and observability foundation required by every later GiyaHero domain.

**Primary stack:** Next.js, TypeScript, pnpm, Tailwind CSS, Supabase CLI/PostgreSQL/Auth/Storage, Zod, Vitest, Playwright, GitHub Actions, Vercel, Sentry.

## Required repository structure

```text
src/
  app/
  modules/
  infrastructure/
  shared/
supabase/
  migrations/
  seed/
  functions/
tests/
  unit/
  integration/
  e2e/
  security/
docs/
.github/workflows/
```

## Tasks

1. Scaffold Next.js with TypeScript, App Router, Tailwind, ESLint, Prettier, Vitest, and Playwright.
2. Add explicit aliases for domain modules, infrastructure, and shared code.
3. Document repository boundaries so domain code cannot depend on UI code.
4. Add validated environment parsing with Zod.
5. Separate browser safe Supabase configuration from server only service role/database credentials.
6. Implement browser, server, and admin Supabase client factories.
7. Add local Supabase configuration, first migrations, seeds, and reproducible database reset scripts.
8. Add a database health probe and `/api/health` route.
9. Add request IDs and structured logging.
10. Add Sentry instrumentation baseline.
11. Add GitHub Actions jobs for formatting, lint, typecheck, unit tests, integration/database tests, E2E tests, and production build.
12. Add environment and deployment documentation for local, staging, and production.
13. Add Vercel configuration and keep secrets outside Git.

## Tests and invariants

1. Missing required environment variables fail clearly.
2. Service role credentials cannot appear in browser modules.
3. Repository aliases and module boundaries remain explicit.
4. Database health fails when PostgreSQL is unavailable.
5. Optional provider degradation must not mark the entire marketplace unavailable.
6. A clean Supabase reset can reconstruct the local schema.
7. CI must run without production credentials.
8. Home/E2E smoke coverage proves the application can start and render.

## Release gate

The phase is complete only when formatting, lint, typecheck, unit tests, production build, Supabase integration tests, and Playwright E2E checks are green in CI and the repository can be bootstrapped without manual production configuration.

## Current implementation reference

The implementation work for this phase is tracked on `feat/foundation-delivery`. The final documentation branch preserves the approved plan independently from active feature work.
