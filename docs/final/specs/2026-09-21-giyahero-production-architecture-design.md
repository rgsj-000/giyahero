# GiyaHero Production Architecture Specification

**Status:** Approved
**Product:** GiyaHero
**Initial geography:** Quezon Province, Philippines
**Expansion posture:** Multi province ready
**Architecture style:** Production ready modular monolith

## Purpose

GiyaHero is a travel marketplace that connects travelers with legitimate verified travel agencies serving Quezon Province. It should feel familiar to users of ecommerce platforms, but the transaction model is designed for travel products where availability, capacity, schedules, quotations, agency confirmation, cancellation terms, and actual service delivery matter.

The platform supports two marketplace paths:

1. Predefined travel packages
2. Custom trip inquiries and agency quotations

Release 1 is intended to onboard real agencies and support real booking operations. Platform managed payment is deliberately deferred to a later module.

## Product principles

1. Travel agencies remain the actual service providers.
2. GiyaHero is the marketplace, trust, workflow, discovery, comparison, booking coordination, and audit layer.
3. AI assists with interpretation, matching, and explanation only.
4. AI must never invent price, schedule, availability, verification status, rating, inclusion, or quotation values.
5. PostgreSQL is the source of truth for booking, inventory, commission, and transactional state.
6. Guests may browse publicly without signing in.
7. Authentication is required for saved trips, inquiries, quotations, reservations, bookings, messaging, and reviews.
8. Only verified agencies may publish public packages.
9. Historical bookings preserve the commercial terms accepted at confirmation time.
10. Critical actions are auditable.
11. The marketplace must continue working if the AI provider is unavailable.

## Release 1 scope

### Included

Public marketplace, traveler authentication, Google OAuth, email verification, manual agency verification, multi staff agency organizations, agency RBAC, package creation and publishing, first package review, trusted agency self publishing, fixed departures, open date packages, per person pricing, per group pricing, tiered pricing support, variant pricing support, cancellation and rescheduling policies, temporary inventory holds, custom trip inquiries, AI assisted structuring, deterministic agency and package matching, quotation versioning, quotation comparison, request to book, agency confirmation, external payment status tracking, configurable commissions, context based messaging, verified booking reviews, notifications, moderation, audit logging, CI/CD, staging and production operations.

### Deferred

Platform managed traveler payments, automated agency settlement, automated refunds, instant booking, native mobile applications, public partner API, dedicated search infrastructure, push notifications, and rollout outside Quezon.

## User and organization model

### Traveler

Guests can browse. Logged in travelers can save packages, submit custom inquiries, accept quotations, request reservations, manage bookings, message agencies, and submit verified reviews.

### Agency organization

One agency organization can contain multiple staff accounts.

Roles:

1. Agency Owner
2. Agency Manager
3. Booking Staff
4. Content Staff
5. Read Only Staff

Authorization requires both role permission and resource ownership.

### Platform administration

Platform permissions are separate from agency membership.

Initial roles:

1. Super Admin
2. Agency Verifier
3. Moderator
4. Support
5. Finance
6. Content Admin

Admin permissions are capability based, such as `agency.verify`, `package.moderate`, `commission.manage`, and `audit.read`. MFA is mandatory for admins.

## Core marketplace flows

### Predefined package

`Browse → Search/Filter → Package Details → Select Departure or Preferred Date → Reservation Request → Agency Confirmation → Booking → External Payment Status → Trip → Verified Review`

### Custom trip

`Traveler Requirements → AI Assisted Structuring → Deterministic Matching → Agency Quotations → Compare → Select Quotation Version → Reservation Request → Agency Confirmation → Booking → Trip → Verified Review`

Release 1 uses request to book. Instant booking is deferred until inventory synchronization is reliable.

## Package model

A package belongs to a verified agency and contains structured data for title, description, destinations, duration, trip type, itinerary, inclusions, exclusions, meeting point, transport, accommodation, media, pricing, schedule, availability, policies, and publication state.

Pricing families:

1. Per person
2. Per group
3. Tiered
4. Variant

Money is stored as integer centavos with ISO currency code. Percentage rates are stored as basis points.

## Scheduling and inventory

Package scheduling supports fixed departures and open date products.

Fixed departures contain departure time, return time, capacity, booking cutoff, and state. Available capacity is derived from total capacity minus confirmed travelers minus active inventory holds.

Temporary holds are created inside PostgreSQL transactions. Critical inventory operations lock the departure row before calculating availability. Redis may support caching and rate limiting, but PostgreSQL remains authoritative for seat inventory.

## Agency verification and publishing

Agency lifecycle:

`Draft → Submitted → Under Review → Verified / Rejected → Suspended when necessary`

Verification files live in private storage and are served through authorized signed URLs.

Publishing model:

1. Verified agency prepares a package.
2. The first package requires platform review.
3. After successful review, trusted verified agencies may self publish.
4. Automated validation remains mandatory.
5. Admins may request correction, unpublish content, suspend publishing privileges, or suspend the agency.

## Cancellation, rescheduling, and no show

GiyaHero standardizes the structure while agencies control the actual terms. Every published package must define explicit cancellation, rescheduling, no show, and agency initiated cancellation terms.

Cancellation and rescheduling use separate transactional records rather than only changing a booking status field.

## Review model

Only a traveler with a completed GiyaHero booking can review. One completed booking can generate at most one traveler review. Category ratings may include package accuracy, communication, value, transportation/service quality, and itinerary experience. Agencies may respond. The Verified Booking indicator is derived automatically.

## Messaging

Messaging is context bound rather than unrestricted chat. Every conversation belongs to an Inquiry, Quotation, or Booking and may contain user messages, attachments, and system timeline events.

## Commission model

Commission is tracked from Release 1 even while travelers pay agencies externally.

Resolution priority:

1. Campaign or package override
2. Agency specific rule
3. Platform default

The resolved commission rate is snapshotted into the confirmed booking so later rule changes do not modify historical transactions.

Commission states include Pending, Earned, Billed, Paid, Waived, and Disputed.

## AI architecture

AI is accessed through a replaceable `TravelAssistantService` provider adapter.

Approved boundary:

`AI = interpretation + matching assistance + explanation`

`Database = source of truth`

`Agency = source of actual availability and quotation values`

`GiyaHero = marketplace + workflow + trust layer`

AI may interpret natural language, extract structured preferences, help prepare inquiries, and explain database selected recommendations. Deterministic database rules decide eligible packages and agencies. If AI is unavailable, users continue through structured forms and ordinary search/filtering.

## Technical architecture

Primary stack:

1. Next.js + TypeScript
2. PostgreSQL via Supabase
3. Supabase Auth
4. Supabase Storage
5. Upstash Redis
6. Trigger.dev or equivalent background jobs
7. Vercel
8. GitHub Actions
9. Sentry
10. OpenTelemetry ready instrumentation

The system begins as a modular monolith with explicit domain boundaries and can later extract services if operational scale requires it.

## Domain modules

Identity, Agencies, Geography, Packages, Pricing, Availability, Inventory, Search, Inquiries, AI, Matching, Quotations, Bookings, Cancellations, Rescheduling, Commissions, Messaging, Reviews, Notifications, Audit, Admin, and future Payments.

Business logic belongs inside modules. Infrastructure modules provide database, auth, storage, cache, jobs, email, AI adapters, and monitoring. UI calls application/domain services and does not own business policy.

## Database model

Core entities include:

`profiles`, `platform_admin_memberships`, `agencies`, `agency_members`, `agency_invitations`, `agency_verification_submissions`, `agency_verification_documents`, geographic tables, `destinations`, `agency_service_areas`, `packages`, package destinations/content/media/policies, package pricing tables, `package_departures`, `inventory_holds`, `travel_inquiries`, `inquiry_agency_matches`, `quotations`, `quotation_versions`, `quotation_items`, `bookings`, `booking_status_history`, `booking_snapshots`, `booking_travelers`, `external_payment_records`, `commission_rules`, `booking_commissions`, cancellation/reschedule requests, conversations, messages, reviews, notifications, `outbox_events`, and `audit_events`.

Bookings created from both predefined packages and accepted quotations use the same booking domain. `source_type` identifies the origin.

## Booking state model

Primary path:

`REQUESTED → PENDING_AGENCY → CONFIRMED → AWAITING_EXTERNAL_PAYMENT → PAID_EXTERNALLY → UPCOMING → IN_PROGRESS → COMPLETED`

Alternative terminal or exception states include REJECTED, CANCELLED, EXPIRED, and NO_SHOW.

Legal transitions are enforced through BookingService rather than arbitrary SQL updates.

## Booking snapshots

At confirmation time, GiyaHero snapshots package or quotation details, pricing, schedule, policies, agency identity, and commission. Later edits to packages or commission configuration must not rewrite historical agreements.

## API model

Business operations use versioned REST style endpoints under `/api/v1` where an HTTP boundary is useful. Server Components may call domain services directly when no public API boundary is needed.

Critical mutations are server controlled. Browser code must not directly create bookings, mutate inventory, change commissions, or alter verification state.

External requests are validated with Zod plus database constraints.

## Concurrency and idempotency

Reservation and inventory operations use PostgreSQL transactions and row locks. Important mutations support idempotency keys. Optimistic concurrency/version fields protect administrative edits such as package updates from silent overwrite.

## Transaction boundaries

A booking confirmation transaction typically validates state and authorization, converts the active hold if applicable, changes booking state, creates a snapshot, resolves and snapshots commission, creates commission ledger state, writes booking history, writes a transactional outbox event, then commits. Any required failure rolls back the entire transaction.

## Background processing

A transactional outbox records committed domain events. Background workers handle email, notifications, hold expiration, quotation expiration, trip reminders, review invitations, analytics updates, and other non critical side effects. Retries use exponential backoff and repeated failures enter a visible dead letter state.

## Frontend information architecture

### Public

Home, Explore, Destinations, Agencies, Package Details, Compare, AI Travel Assistant.

### Traveler

Dashboard, Saved Trips, Custom Inquiries, Quotations, Bookings, Messages, Reviews, Profile.

### Agency

Dashboard, Packages, Departures, Inquiries, Quotations, Bookings, Messages, Reviews, Analytics, Staff, Organization, Verification, Commissions, Settings.

### Admin

Dashboard, Agencies, Verification, Packages, Users, Bookings, Commissions, Reviews, Moderation, Reports, Audit Logs, Configuration.

## UX principles

Traveler experience is mobile first. Agency/admin interfaces are desktop optimized while remaining responsive. Public filters are URL addressable. Package pages are server rendered where practical. The AI assistant starts from structured trip inputs rather than an empty generic chat box. Backend state names are translated into plain language. Accessibility target is WCAG 2.2 AA.

Recommended UI foundation: Tailwind CSS, shadcn/ui primitives, Radix UI, and Lucide icons, customized to GiyaHero branding.

## Repository structure

```text
giyahero/
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

## Environments and delivery

Three isolated environments are required: local, staging, production. Each has separate database, auth data, storage, API keys, and secrets.

Migrations live in Git and are applied through controlled delivery workflows. Normal production schema changes must not be made manually through the database dashboard. Breaking changes use expand, migrate, contract.

`main` is protected. CI runs formatting, linting, type checking, unit tests, integration/database tests, production build, and E2E coverage before merge. Preview deployments support review. Production uses Vercel with separate Supabase, Redis, worker, monitoring, and external provider configuration.

## Security

Security controls include Supabase Row Level Security, server side authorization, ownership checks, admin MFA, rate limiting, HTTPS, HSTS, Content Security Policy, secure cookies, secret scanning, dependency scanning, private signed file URLs, structured audit logs, and strict separation between browser safe and privileged credentials.

## Storage

Separate buckets are used for public package/agency media and private verification, message attachment, and booking document data. Private files use signed temporary URLs after authorization. Uploads validate MIME type, extension, size, ownership, and bucket permissions.

## Observability and recovery

Monitor HTTP errors, API latency, database latency, failed jobs, auth failures, AI provider failures, email failures, inventory conflicts, booking failures, and database connection usage. Structured logs include request IDs and exclude sensitive data. Sentry is the initial error monitoring service.

Initial recovery targets are approximately one hour or better RPO depending on the Supabase plan and four hour RTO. Recovery design includes database backups, point in time recovery when available, Git migration history, storage backup policy, restore testing, Vercel rollback, and forward fix database strategy.

## Search

Release 1 uses PostgreSQL search and indexed relational filters for destination, municipality, budget, date, duration, trip type, agency, rating, group size, transportation, accommodation, interests, and package features. A dedicated search engine is deferred until usage justifies it.

## Critical acceptance tests

1. Concurrent fixed departure requests cannot overbook capacity.
2. Travelers cannot read other travelers' private bookings.
3. Agency A cannot access Agency B private records.
4. Expired quotations cannot be accepted.
5. Unverified agencies cannot publish packages.
6. Completed bookings allow at most one verified review.
7. Historical commission rates remain stable after configuration changes.
8. Holds expire and release capacity.
9. Booking confirmation creates snapshot and commission state atomically.
10. AI failure does not prevent normal marketplace operation.

## End to end acceptance paths

Package path:

`Register → Browse Package → Select Departure → Request Seats → Inventory Hold → Agency Confirms → Booking Snapshot → Commission → External Payment Status → Trip Completed → Verified Review`

Custom path:

`Submit Requirements → AI Structuring → Deterministic Matching → Agency Quotations → Compare → Accept Quotation Version → Booking → Agency Confirmation → Trip Completed`

## Locked decisions

Production ready from the beginning; Quezon first with multi province capable data design; payments deferred; manual agency verification; multi staff agency organizations; public browsing without login; packages plus custom quotations; request to book; four pricing model families; standardized but agency controlled cancellation terms; configurable commissions; verified booking reviews; context based messaging; email/password plus Google OAuth; mandatory admin MFA; hybrid database grounded AI; first package approval then trusted self publishing; fixed and open date scheduling; temporary inventory holds; modular monolith; REST v1 plus internal services; server controlled critical writes; transactional outbox; Git controlled database migrations; isolated local/staging/production environments.
