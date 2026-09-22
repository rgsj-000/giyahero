# GiyaHero 07 Admin Operations, Security Hardening, Observability, and Launch Implementation Plan

**Goal:** Turn the functionally complete marketplace into an operationally safe production service with explicit admin workflows, security controls, audit visibility, monitoring, backup/restore, rollback, and staging launch acceptance.

## Admin operations

1. Build admin dashboards around exceptions and pending actions rather than vanity metrics.
2. Implement agency verification queue and decision workflows.
3. Implement package moderation and publishing restriction workflows.
4. Implement user, booking, review, commission, and support inspection views with capability based access.
5. Add commission dispute/waiver operational actions.
6. Add failed job/dead letter visibility and controlled retry actions.
7. Add audit log search/filtering with immutable source records.
8. Protect sensitive admin actions with explicit capabilities and mandatory MFA.

## Security hardening

1. Review and test RLS for all private tables.
2. Add rate limiting for authentication, password reset, AI, messaging, inquiry submission, quotation submission, reviews, and uploads.
3. Enforce HTTPS, HSTS, Content Security Policy, secure cookies, SameSite policy, referrer policy, and MIME protections.
4. Add dependency and secret scanning in CI.
5. Review private bucket policies and signed URL lifetimes.
6. Validate upload MIME type, extension, size, ownership, and destination bucket.
7. Ensure privileged secrets never use browser exposed environment variables.
8. Add request IDs across application logs, jobs, and provider calls.
9. Confirm logs do not contain passwords, tokens, OTPs, card data, verification document contents, or unnecessary personal information.

## Observability

Monitor at minimum:

1. HTTP error rate
2. API latency
3. Database latency
4. Failed jobs/dead letters
5. Authentication failures
6. AI provider failures/timeouts
7. Email delivery failures
8. Inventory conflicts
9. Booking failures
10. Database connection usage

Sentry is the initial error monitoring platform. Instrumentation should remain OpenTelemetry ready.

## Health model

`/api/health` should distinguish core service failure from optional provider degradation. A database failure can mark the service unhealthy. AI/email provider degradation should not necessarily mark the marketplace fully unavailable.

## Backup and recovery

1. Enable database backup capabilities appropriate to the production Supabase plan.
2. Use point in time recovery when available.
3. Keep complete migration history in Git.
4. Define a storage backup policy.
5. Perform periodic restore drills.
6. Document Vercel application rollback.
7. Prefer backward compatible schema delivery and forward fix database recovery over unsafe rollback migrations.
8. Initial target RPO: approximately one hour or better depending on infrastructure plan.
9. Initial target RTO: four hours.

## Deployment and environment readiness

1. Maintain separate staging and production Supabase/Vercel/provider configuration.
2. Use synthetic or approved test data in staging.
3. Do not copy live traveler personal data into staging without approved anonymization.
4. Protect `main` and require CI/review gates.
5. Verify database migration order before production deployment.
6. Run smoke tests immediately after deployment.
7. Document incident response and rollback steps.

## Production acceptance tests

### Package path

`Register Traveler → Browse Published Package → Select Departure → Request Seats → Hold → Agency Confirmation → Booking Snapshot → Commission → External Payment Status → Trip Lifecycle → Verified Review`

### Custom trip path

`Submit Requirements → AI/Structured Inquiry → Deterministic Agency Match → Multiple Quotations → Compare → Accept Specific Version → Booking → Agency Confirmation → Trip Lifecycle`

### Security and resilience acceptance

1. Cross traveler access is denied.
2. Cross agency access is denied.
3. Unverified agencies cannot publish.
4. Admin capabilities are enforced and MFA protected.
5. Simultaneous reservations cannot overbook.
6. Expired holds release inventory.
7. Failed notification/email jobs retry without duplicating business transactions.
8. AI outage falls back to normal marketplace flows.
9. Backup restore procedure is demonstrated in a non production environment.
10. Previous Vercel deployment can be promoted during rollback exercise.

## Release gate

Production launch is allowed only after staging demonstrates both primary marketplace paths, security boundary tests pass, monitoring and alerting are active, backup/restore and rollback procedures are documented and exercised, secrets and environment separation are verified, and there are no unresolved critical operational defects.
