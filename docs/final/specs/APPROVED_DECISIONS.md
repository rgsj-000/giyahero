# GiyaHero Approved Decisions Register

This file records the product and architecture decisions explicitly approved before implementation.

## Product and marketplace decisions

1. GiyaHero will be built as a production capable platform, not a disposable PSC XI demo.
2. Release 1 is operationally Quezon Province first, while core geography, permissions, package coverage, and data relationships remain multi province ready.
3. Public users may browse packages without signing in.
4. Login is required for saved trips, persistent comparison, inquiries, reservation requests, bookings, messaging, and reviews.
5. The marketplace supports both predefined packages and custom quotation requests.
6. Package bookings and accepted quotation bookings converge into one Booking domain.
7. Release 1 uses request to book with agency confirmation rather than instant booking.
8. Fixed departure and open date products are both supported.
9. Pricing data supports per person, per group, tiered, and variant pricing.
10. Every published package must define cancellation, rescheduling, no show, and agency cancellation terms.
11. Reviews are allowed only for completed GiyaHero bookings and receive a derived Verified Booking indicator.
12. Messaging is context based and attached to an Inquiry, Quotation, or Booking.

## Agency and trust decisions

13. Agency verification is manual in Release 1.
14. Unverified agencies may prepare profiles and draft package content but cannot publish public packages.
15. An agency is an organization with multiple staff accounts.
16. Initial agency roles are Owner, Manager, Booking Staff, Content Staff, and Read Only Staff.
17. Platform admin roles are separate from agency roles.
18. The first package from a newly verified agency requires review.
19. Trusted verified agencies may self publish after their first successful package review.
20. Administrators retain moderation, suspension, unpublish, and publishing restriction powers.

## Authentication and security decisions

21. Travelers use email/password, Google sign in, and email verification.
22. Agency staff use email/password or Google sign in, mandatory email verification, and invitation based staff onboarding.
23. Platform admins require MFA.
24. Phone OTP is deferred unless later justified.
25. Authorization requires both role permission and resource ownership.
26. Supabase RLS provides database level defense in depth.
27. Critical business writes are server controlled and never performed directly by browser code.

## AI decisions

28. AI is a bounded travel assistant, not the source of truth.
29. AI may parse natural language into structured travel preferences.
30. Deterministic database logic identifies eligible packages and agencies.
31. AI may explain recommendations after database selection.
32. Agencies remain the source of actual availability and custom quotation values.
33. AI must never invent price, availability, verification status, rating, schedule, inclusion, or quotation values.
34. The core marketplace must remain usable if AI is unavailable.
35. AI provider access is isolated behind a replaceable adapter.

## Inventory and booking decisions

36. Fixed departure overbooking protection uses temporary inventory holds with configurable expiration.
37. PostgreSQL is authoritative for capacity and reservation state.
38. Critical inventory changes use database transactions and row locking.
39. Important mutation APIs use idempotency protection.
40. Booking state changes occur through an explicit state machine.
41. Confirmed bookings preserve immutable commercial snapshots.
42. Package, quotation, policy, schedule, agency, and commission data needed for historical accuracy are snapshotted at confirmation.

## Commission and payment decisions

43. Commission is tracked from Release 1 even while payment occurs externally.
44. Commission configuration is not hard coded.
45. Rule precedence is package/campaign override, then agency specific rate, then platform default.
46. The resolved rate is snapshotted into the booking.
47. Release 1 records external payment status only.
48. Platform managed payments, settlement, automated refunding, reconciliation, and chargeback handling are future modules.

## Technical architecture decisions

49. GiyaHero begins as a Next.js + TypeScript modular monolith.
50. PostgreSQL/Supabase is the primary data platform.
51. Supabase Auth and Storage are used for authentication and object storage.
52. Upstash Redis is used for rate limiting and suitable cache workloads, not as booking source of truth.
53. Background processing uses Trigger.dev or an equivalent job abstraction.
54. Vercel is the initial application hosting platform.
55. GitHub Actions provides CI/CD verification.
56. Sentry provides initial error monitoring.
57. OpenTelemetry readiness is preserved for future distributed tracing.
58. Business logic lives in domain modules, not React components or route handlers.
59. REST style `/api/v1` endpoints are used where an HTTP boundary is useful; internal server code may call domain services directly.
60. A transactional outbox is used for reliable post commit events.
61. Git controlled Supabase migrations are the normal schema change mechanism.
62. Local, staging, and production environments remain isolated.
63. Production data is not copied into staging without approved anonymization.
64. `main` should be protected by automated checks and review gates.

## Frontend decisions

65. Traveler UX is mobile first.
66. Agency and admin operational interfaces are desktop optimized while remaining responsive.
67. Marketplace filtering state is reflected in URLs.
68. Public package pages use server rendering where practical.
69. Package comparison is a first class experience.
70. The AI assistant begins from structured trip context rather than a blank generic chat screen.
71. Backend status codes are translated into plain language for users.
72. Accessibility target is WCAG 2.2 AA.
73. Initial UI foundation uses Tailwind CSS, shadcn/ui primitives, Radix UI, and Lucide icons with custom GiyaHero branding.

## Delivery decisions

74. Work proceeds in staged implementation plans with tests and release gates.
75. Foundation and delivery are completed before identity and marketplace domains.
76. Booking/inventory work follows catalog and scheduling so concurrency logic is built on stable product data.
77. Custom inquiry and AI work reuses the existing Booking domain rather than creating a second transaction engine.
78. Messaging, notifications, reviews, and dashboards are added after core marketplace transactions exist.
79. Admin hardening, security, observability, backup/restore, rollback, and launch acceptance form the final production readiness phase.
