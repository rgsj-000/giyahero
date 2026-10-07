# Environment separation

| Environment | Purpose                                              | Data rule                                       |
| ----------- | ---------------------------------------------------- | ----------------------------------------------- |
| LOCAL       | Developer machines and automated local tests         | Synthetic data only                             |
| STAGING     | Pre-production validation and stakeholder acceptance | Synthetic or explicitly approved test data only |
| PRODUCTION  | Live GiyaHero service                                | Production data                                 |

Each environment must use separate Supabase projects or local stacks, storage buckets, OAuth callback URLs, Redis credentials, and AI/email credentials. Production personal data must never be copied into staging.

The mobile app has a separate `mobile/.env.local` containing public `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_ORIGIN`, and `VITE_AUTH_CALLBACK_URL`. Use a distinct staging app identifier ending in `.staging`. Signing secrets belong in protected CI environments; service-role/database credentials never belong in the mobile bundle. See [mobile staging setup](./mobile-release.md).
