# Deployment process

1. Open a pull request and review the Vercel preview deployment.
2. Require CI to pass before merge.
3. Review database migrations for backward compatibility and destructive operations.
4. Apply migrations to staging and run the critical marketplace smoke tests.
5. Merge to the protected `main` branch only after staging verification.
6. Deploy production and verify `/api/health` plus the public home page.
7. If the application deployment is unhealthy, promote the previous Vercel deployment and prepare a forward database fix rather than blindly reversing a migration.

Mobile release preparation and device verification are described in [mobile-release.md](./mobile-release.md). Generate the domain association files from the actual signing identities before deploying the hosted callback domain. The public `/.well-known/` files must be reachable without login, redirect, or deployment protection. Web deployment does not rebuild already installed mobile bundles; rebuild and sync native assets after configuration changes.
