# Database migration policy

1. Every schema change is represented by a timestamped SQL migration in `supabase/migrations`.
2. Normal production changes are never made manually in the Supabase dashboard.
3. Breaking changes use expand, migrate, contract across separate deployments.
4. Migrations must be tested with `supabase db reset` before merge.
5. Destructive changes require an explicit backup and restore note in the pull request.
6. Production migrations must remain backward compatible with the currently deployed application until the new deployment is healthy.
