# Deployment process

1. Open a pull request and review the Vercel preview deployment.
2. Require CI to pass before merge.
3. Review database migrations for backward compatibility and destructive operations.
4. Apply migrations to staging and run the critical marketplace smoke tests.
5. Merge to the protected `main` branch only after staging verification.
6. Deploy production and verify `/api/health` plus the public home page.
7. If the application deployment is unhealthy, promote the previous Vercel deployment and prepare a forward database fix rather than blindly reversing a migration.
