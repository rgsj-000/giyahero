# GiyaHero 05 Custom Inquiries, AI Assistance, Matching, and Quotations Implementation Plan

**Goal:** Add GiyaHero's custom trip transaction path without creating a second booking engine.

## Tasks

1. Create structured travel inquiry tables for origin, dates, group size, budget, duration, interests, travel style, accessibility needs, accommodation, transportation, and additional requests.
2. Allow travelers to create and review inquiries before submission.
3. Add AI preference extraction through `TravelAssistantService` and a replaceable provider adapter.
4. Validate AI structured output before it reaches domain state.
5. Keep AI optional with a structured form fallback.
6. Implement deterministic eligibility filtering using agency coverage, verification, active status, relevant package/service capability, budget/date constraints where applicable, and other approved criteria.
7. Record agency matches and reasons/scores.
8. Use AI only to explain matching results after deterministic candidate selection.
9. Notify matched agencies and allow them to view/decline/respond to inquiries.
10. Create quotation parent records and immutable quotation versions.
11. Add structured quotation line items, terms, expiry, itinerary/notes, and total calculations.
12. Allow agencies to revise quotations by creating a new version rather than mutating an accepted version.
13. Build traveler quotation comparison.
14. Require acceptance of a specific quotation version.
15. Convert an accepted quotation version into the existing Booking domain and then follow ordinary agency confirmation and trip lifecycle rules.
16. Add quotation expiration jobs and notifications.
17. Add AI usage/error telemetry without logging unnecessary traveler private data.

## AI boundary

AI may interpret natural language and explain results. It cannot invent marketplace facts. Prices, availability, verification, ratings, schedules, package inclusions, and quotations come from PostgreSQL or the responsible agency.

## Required tests

1. Invalid AI output is rejected safely.
2. AI outage falls back to ordinary structured inquiry flow.
3. Ineligible/unverified agencies are never matched.
4. Match explanations cannot override deterministic eligibility.
5. Agencies can only access inquiries matched/authorized for them.
6. Quotation totals use integer centavos.
7. Quotation revisions create new versions.
8. Expired quotation versions cannot be accepted.
9. Accepting a quotation is idempotent.
10. The booking created from a quotation references the exact accepted version.
11. Package and quotation bookings share the same downstream BookingService lifecycle.

## Release gate

A traveler can describe or enter trip requirements, receive deterministic matches with optional AI assistance, obtain multiple structured agency quotations, compare them, accept a specific valid version, and enter the established booking workflow without depending on AI availability.
