# GiyaHero 06 Messaging, Notifications, Saved Trips, Reviews, and Dashboards Implementation Plan

**Goal:** Add the collaboration, retention, and trust layer around completed core marketplace transactions.

## Tasks

1. Create conversations tied to valid Inquiry, Quotation, or Booking contexts.
2. Add conversation participant rules for travelers and authorized agency staff.
3. Add message types for user text, system events, status events, and attachments.
4. Store message attachments privately and authorize access with signed URLs.
5. Add system generated timeline messages for important workflow events.
6. Build in app notification records and delivery tracking.
7. Generate email notifications from committed domain events through the outbox/worker system.
8. Cover new quotations, booking confirmation/rejection, trip reminders, schedule changes, cancellation responses, new messages, verification decisions, and review invitations.
9. Add saved packages and persistent comparison lists for authenticated travelers.
10. Keep guest comparison state browser local until authentication.
11. Add reviews derived from completed booking eligibility.
12. Enforce one review per eligible booking.
13. Add overall rating, category ratings, written feedback, optional photos, moderation state, and agency response.
14. Derive Verified Booking automatically from the completed booking reference.
15. Add traveler dashboard summarizing upcoming trips, active inquiries, quotations, saved packages, messages, and review actions.
16. Add agency dashboard emphasizing operational actions: pending confirmation, new inquiries, expiring quotations, messages, upcoming departures, booking value, and commission state.

## Messaging rules

1. No unrestricted unsolicited traveler/agency chat.
2. A conversation must have a valid workflow context.
3. Agency access is limited to staff belonging to the owning agency.
4. System timeline events are immutable.
5. Sensitive contact information should not be exposed by default when the platform can coordinate the workflow internally.

## Notification reliability

Notifications are triggered from committed events rather than blocking the transaction that produced them. Delivery failures retry with backoff. Repeated failures remain visible for operations instead of being silently discarded.

## Required tests

1. Travelers cannot open another traveler's private conversation.
2. Agency A cannot read Agency B conversations.
3. Messages require a valid context and participant.
4. Private attachment URLs require authorization.
5. Domain event processing creates the expected notification once.
6. Notification retries are idempotent.
7. Only completed bookings are review eligible.
8. One booking cannot create multiple traveler reviews.
9. A review cannot claim Verified Booking without a valid completed booking.
10. Agency responses are limited to the reviewed agency.
11. Guest saved/compare behavior does not create server side private state until authentication.

## Release gate

Travelers and agencies can collaborate inside valid workflow contexts, receive reliable notifications, manage saved/comparison state, submit and respond to verified reviews, and use dashboards that surface actionable marketplace state without bypassing authorization boundaries.
