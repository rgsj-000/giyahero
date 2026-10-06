# Environment separation

| Environment | Purpose                                              | Data rule                                       |
| ----------- | ---------------------------------------------------- | ----------------------------------------------- |
| LOCAL       | Developer machines and automated local tests         | Synthetic data only                             |
| STAGING     | Pre-production validation and stakeholder acceptance | Synthetic or explicitly approved test data only |
| PRODUCTION  | Live GiyaHero service                                | Production data                                 |

Each environment must use separate Supabase projects or local stacks, storage buckets, OAuth callback URLs, Redis credentials, and AI/email credentials. Production personal data must never be copied into staging.
