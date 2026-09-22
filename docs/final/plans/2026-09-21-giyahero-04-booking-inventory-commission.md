# GiyaHero 04 Inventory, Reservations, Bookings, External Payment, and Commission Implementation Plan

**Goal:** Implement the request to book transaction engine with safe fixed departure inventory, legal booking transitions, immutable commercial snapshots, external payment tracking, configurable commissions, and reliable domain events.

## Tasks

1. Create fixed departure inventory and temporary hold tables.
2. Implement transactional hold creation using PostgreSQL row locking.
3. Calculate availability from capacity minus confirmed travelers minus active holds.
4. Add hold expiration jobs and release capacity automatically.
5. Add idempotency support for reservation creation and booking confirmation.
6. Create Booking aggregate shared by predefined packages and later custom quotations.
7. Implement booking source type and references.
8. Implement legal booking state transitions through BookingService.
9. Create booking status history.
10. Create immutable booking snapshots for product, agency, pricing, policies, schedule, and commission.
11. Add booking traveler records while minimizing unnecessary sensitive data.
12. Add agency confirmation/rejection and traveler cancellation/reschedule request workflows.
13. Add Release 1 external payment status recording without storing payment credentials.
14. Create configurable commission rules with platform default, agency, package, and campaign scopes.
15. Resolve commission precedence and snapshot rate/amount into the booking.
16. Create commission ledger states: Pending, Earned, Billed, Paid, Waived, Disputed.
17. Write transactional outbox events during booking commits.
18. Add worker processing for notifications, hold expiration, reminders, and later analytics.

## Booking state machine

Primary path:

`REQUESTED → PENDING_AGENCY → CONFIRMED → AWAITING_EXTERNAL_PAYMENT → PAID_EXTERNALLY → UPCOMING → IN_PROGRESS → COMPLETED`

Exception states include REJECTED, CANCELLED, EXPIRED, and NO_SHOW.

## Transaction rule

Booking confirmation must atomically validate state and authorization, convert/release inventory hold as needed, change booking state, create commercial snapshot, resolve commission, create commission ledger state, write history, write outbox event, and commit. Any required failure rolls back.

## Required tests

1. Two concurrent requests cannot overbook the same departure.
2. Expired holds no longer consume capacity.
3. Duplicate idempotency keys cannot create duplicate reservations.
4. Illegal booking state transitions are rejected.
5. Booking confirmation snapshots package and policy data.
6. Historical snapshots remain unchanged after package edits.
7. Commission precedence resolves correctly.
8. Historical commission remains unchanged after commission rule edits.
9. Agency A cannot confirm Agency B bookings.
10. External payment records never store card/OTP/password data.
11. Outbox event creation is atomic with the booking transaction.

## Release gate

The complete predefined package transaction path works under concurrency: reservation request, temporary hold, agency confirmation, booking snapshot, commission creation, external payment status, trip lifecycle, and auditable status history.
