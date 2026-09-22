# GiyaHero Production Implementation Program

**Status:** Approved for execution
**Architecture source:** `../specs/2026-09-21-giyahero-production-architecture-design.md`

## Goal

Build GiyaHero from an empty repository into a production ready Quezon first travel marketplace that can onboard verified travel agencies, publish and compare travel packages, process request to book reservations, support custom trip inquiries and quotations, and operate safely in staging and production.

## Delivery model

The implementation is divided into seven phases. Each phase has a clear dependency boundary and release gate. The intent is to preserve testability and prevent a large unreviewable implementation batch.

## Phase sequence

1. Foundation and Delivery
2. Identity, Agency Organizations, and Verification
3. Catalog, Pricing, Scheduling, and Public Marketplace
4. Inventory, Reservations, Bookings, External Payment Tracking, and Commission
5. Custom Inquiries, AI Assistance, Matching, and Quotations
6. Messaging, Notifications, Saved Trips, Reviews, and Dashboards
7. Admin Operations, Security Hardening, Observability, and Production Launch

## Cross phase engineering rules

1. Use test driven development for business critical features and bug fixes.
2. Keep business rules inside `src/modules`.
3. Keep infrastructure adapters inside `src/infrastructure`.
4. Keep shared primitives domain neutral.
5. Critical writes run server side.
6. PostgreSQL is authoritative for booking and inventory state.
7. Use RLS plus application authorization for private domain data.
8. Use migrations for schema changes.
9. Preserve idempotency for retry prone transaction APIs.
10. Use a transactional outbox for side effects after commit.
11. Add integration coverage for database invariants and authorization boundaries.
12. Add E2E coverage for traveler and agency critical paths.
13. Do not move to the next phase until the current phase release gate is satisfied.

## Release gates

### Phase 1 gate

Application builds, formatting/lint/typecheck/unit tests pass, local Supabase rebuild works from migrations, integration tests pass, E2E smoke test passes, environment boundaries are validated, and CI reproduces the checks.

### Phase 2 gate

Traveler authentication works, agency organizations and invitations work, staff roles are enforced, admins are separated from agency roles, manual verification workflow works, private verification files are protected, and RLS tests prove cross tenant isolation.

### Phase 3 gate

Verified agencies can author packages, first package moderation works, trusted self publishing works, pricing and schedule models support approved variants, fixed departures and open date products can be created, and public marketplace search/filter/package detail flows expose only valid published data.

### Phase 4 gate

Concurrent reservation requests cannot overbook, holds expire correctly, request to book and agency confirmation work, booking snapshots are immutable, external payment status can be recorded, commission is resolved and snapshotted, and the full package booking path passes integration/E2E testing.

### Phase 5 gate

Travelers can create structured custom inquiries, AI assistance is optional and provider isolated, deterministic matching identifies eligible agencies, agencies can version quotations, travelers can compare and accept a specific quotation version, and accepted quotations enter the existing Booking domain.

### Phase 6 gate

Context based messaging, notifications, saved trips/comparison persistence, verified reviews, agency responses, moderation states, and traveler/agency dashboards work without bypassing domain authorization.

### Phase 7 gate

Admin operational workflows, audit visibility, rate limiting, storage security, security headers, monitoring, backup/restore procedures, rollback procedures, staging acceptance, and both primary end to end paths are production ready.

## Primary acceptance paths

### Predefined package

`Traveler Registration → Browse → Package → Departure/Date → Reservation Request → Hold → Agency Confirmation → Booking Snapshot → Commission → External Payment Status → Trip → Verified Review`

### Custom trip

`Traveler Requirements → Structured Inquiry → AI Assistance if available → Deterministic Matching → Agency Quotations → Compare → Accept Version → Booking → Agency Confirmation → Trip`

## Branching expectation

Feature work should use short lived branches from the current integration baseline. `main` remains protected and receives changes through verified pull requests. Documentation snapshots may use dedicated archival branches.
