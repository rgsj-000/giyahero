# GiyaHero 03 Catalog, Pricing, Scheduling, and Public Marketplace Implementation Plan

**Goal:** Build the structured travel product catalog, pricing and scheduling model, agency publishing workflow, and public ecommerce style marketplace.

## Tasks

1. Create national geography tables and seed Quezon Province as the initial operating geography.
2. Add destinations and agency service areas without hard coding Quezon into core relationships.
3. Create the Package aggregate with structured destinations, itinerary, inclusions, exclusions, transport, accommodation, tags, and media.
4. Implement pricing models for per person, per group, tiered, and variant pricing.
5. Store money as integer centavos with ISO currency code.
6. Add package policies for cancellation, rescheduling, no show, and agency cancellation.
7. Implement fixed departure and open date scheduling.
8. Add package publication/moderation states and first package review.
9. Add trusted agency self publishing after successful first review.
10. Enforce publication eligibility: verified active agency, complete required content, valid pricing, valid policies, and valid schedule configuration.
11. Build public package listing/search/filter queries that expose only published packages owned by active verified agencies.
12. Build public package detail pages, agency profile pages, destination pages, and package comparison.
13. Reflect search filters in the URL for shareable and server renderable discovery.
14. Use PostgreSQL indexed relational filtering for Release 1 search.
15. Add package media handling with public storage/CDN friendly paths and validation.

## Marketplace filters

Destination, municipality/city, budget, date, duration, group size, trip type, fixed/open date, accommodation included, transport included, meals included, agency, rating, and relevant package attributes.

## Package lifecycle

`DRAFT → PENDING_FIRST_REVIEW → PUBLISHED → UNPUBLISHED / SUSPENDED / ARCHIVED`

Trusted verified agencies may move valid later packages from Draft to Published without full manual review, while platform moderation remains available.

## Tests

1. Unverified agencies cannot publish.
2. Agency A cannot edit Agency B packages.
3. Public queries never return drafts, suspended agencies, or unpublished packages.
4. Pricing calculations do not use floating point money.
5. Fixed and open date packages validate different scheduling requirements.
6. First package approval controls later trusted self publishing.
7. Package comparison uses normalized structured fields.
8. URL filters produce deterministic marketplace results.

## Release gate

A verified agency can create and preview a structured package, complete pricing/policies/schedule, submit its first package for review, publish after approval, and appear correctly in public search, detail, destination, agency, and comparison experiences.
