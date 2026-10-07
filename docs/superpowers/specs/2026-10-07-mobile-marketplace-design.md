# Android and iPhone Marketplace Release

Date: 2026-10-07
Status: Written specification approved by the user; implementation plan awaiting review.

## Purpose and success criteria

Deliver installable Android and iPhone versions of GiyaHero with real agency listings and booking requests. Travelers browse published packages, sign in, submit a request, and follow its status. Agency staff publish packages and accept or decline requests. A request becomes confirmed only after agency acceptance.

Success requires a complete verified-agency-to-traveler workflow backed by persistent Supabase data, enforced permissions, and tests. A generated native project alone does not constitute a working mobile release. Android installation and iPhone TestFlight installation must each pass device checks before the corresponding release is described as ready.

## Existing foundation

Reuse the current Next.js web application, Supabase authentication, profiles, agencies, agency memberships, verification workflows, and catalog tables. The catalog migration already models destinations, packages, media, itinerary, prices, policies, and departures. Existing publication states and package input validation remain authoritative.

The traveler interface currently reads sample packages and saves preview requests in component state. The catalog currently supplies read policies but no publishing mutations. There is no booking-request persistence. Replace these behaviors along the real marketplace path; never fall back to sample inventory when live queries fail.

## Architecture

Keep Next.js as the web application and host for existing server-dependent administration and verification. Add a separate React mobile entry point built with Vite and packaged with Capacitor for Android and iOS. Bundle compiled assets locally in each native app. Do not enable Next.js static export globally: the existing cookie-based callback and server-rendered administration require a server.

Extract reusable traveler, agency catalog, and booking screens from platform-specific routing and authentication. Shared feature services receive a Supabase client and navigation/session adapters. Web uses its existing browser and server clients; mobile uses its own client and router. Mobile code must not import Next.js server APIs, service-role clients, or database connection credentials.

Authenticated Supabase calls and narrowly scoped transactional Postgres RPCs provide catalog mutations and booking transitions. RLS restricts reads. Privileged application operations remain server-side. Native apps contain only public client configuration. Existing verification and platform administration continue through the hosted web workspace, opened in the system browser from relevant mobile screens.

## Live catalog

Guests may browse published packages belonging to verified agencies. Include agency profiles, destination and budget filters, package detail, itinerary, price options, departure/date selection, and policies. Remove simulated match scores and fabricated quotations from the live flow. Empty inventory has a clear empty state; database failures offer retry.

Owners, managers, and content staff may manage their own agency's package drafts through authenticated transactional operations. Owners and managers submit the first package review. An authorized content administrator or super administrator approves or requests changes. Preserve the existing `pending_first_review`, `changes_requested`, and `first_reviewed_at` concepts. After the first approval, authorized agency publishers may publish valid revisions while the agency remains verified. Every publication revalidates package completeness. Unpublish and archive retain historical request references.

Catalog management includes itinerary, destinations, rate options, policies, departures, and package images. Public media is limited to published catalog content, with upload ownership checks, file size/type validation, and generated storage paths. Private verification documents stay in their existing private storage workflow.

Use integer minor units and the package currency for money. For per-person pricing, multiply the selected eligible rate by total travelers; for per-group pricing use the eligible group rate once. Tiered rates must match group size; variants require explicit selection of an eligible labeled option. Show the chosen basis before submission. The first release uses the same per-person rate for adults and children because the existing catalog has no child-rate field; remove the sample child-discount calculation. Overlapping eligible options require an explicit rate selection.

## Booking request contract

Add `booking_requests` and append-only `booking_request_events`. Each request stores its UUID, traveler ID, agency/package IDs, optional departure ID, requested dates, adult/child counts, selected price option, traveler contact details and notes, status, timestamps, client submission key, and a server-generated snapshot of package version, itinerary, terms, currency, and calculated total.

Traveler identity comes from `auth.uid()`. Agency ownership, dates, traveler limits, visibility, price eligibility, and totals are derived and validated in the database. Do not trust client-supplied identity, agency, status, price, or availability. Constrain referenced package/departure/rate records to the same package and agency. Keep references and snapshots when listings change; archive records with request history rather than cascading deletion.

Requests move from `pending` to `accepted`, `declined`, or `cancelled`. Only agency owners, managers, and booking staff can accept or decline their own agency's pending requests. Travelers can cancel their own pending requests. Acceptance displays as Confirmed in My Trips. Decline requires a traveler-visible explanation. Confirmed cancellations are handled by the agency under the snapshotted policy; the first release supplies an auditable agency cancellation action with a required reason. Terminal records cannot return to pending.

Acceptance confirms the original submitted terms and amount. Editing a package cannot silently change an existing request. A changed quote requires declining the old request with an explanation and inviting a new submission. Payment is arranged with the agency under the displayed terms; acceptance must not imply that payment has been collected. Integrated checkout is a separate release.

## Availability, concurrency, and retries

Pending requests do not reserve seats. Communicate that confirmation depends on agency approval. For fixed departures, acceptance locks the departure and request, checks agency eligibility, active/publication state, cutoff, and remaining capacity, and confirms atomically. Count travelers in accepted requests when calculating used capacity. Serialize catalog changes affecting a departure through the same lock. Reject reductions below confirmed occupancy and destructive edits of departures with confirmed bookings. Cancellation releases capacity in the same transaction.

For open-date packages, validate the requested interval against the availability window and duration. Agency acceptance is a manual commitment to those dates; do not display an invented seat count. If the listing or agency becomes ineligible, block new submissions and acceptance, preserve existing records, and still allow applicable decline/cancellation actions.

A unique traveler/submission-key constraint makes submission retries return the original request. Decision operations lock and validate the current state; repeating the same decision returns the existing result without duplicating events or consuming seats again. Conflicting decisions return a conflict and refresh the screen.

## Permissions and operational screens

Travelers read only their own requests and public listings. Agency owners, managers, and booking staff read and decide requests for their agency. Content staff and read-only members do not receive traveler contact information through the booking workflow. Verification documents and platform admin screens retain their existing stricter permissions.

My Trips shows pending and completed decisions, original package/price details, timestamps, cancellation controls, and agency contact information. The agency inbox shows requests, filters, request detail, and decision controls. Request events record actor, transition, time, and explanation. In-app inbox refresh is required for release one; email and push delivery are subsequent features and do not substitute for the persistent inbox.

## Mobile authentication and behavior

Provide email/password login and registration with session restoration. Confirmation and Google sign-in use the system browser and platform deep links, never an embedded Google login page. Handle the Supabase authorization-code exchange in the correct client context and return users to their intended screen. Register Android app links and iOS universal links using a controlled HTTPS domain. Use a reviewed Keychain/Keystore storage adapter for native persisted sessions; web retains its existing session mechanism. Sign-out clears persisted session state.

Configure splash screens, app icons, safe-area spacing, keyboard behavior, accessible touch targets, Android back navigation, external links, and connection/error states. Browsing and booking require connectivity. Never report a submitted request until the server confirms persistence; an ambiguous timeout keeps the same submission key for retry. Restore request status from the backend after restart.

## Delivery stages

1. Live catalog: database mutations and publication review, agency editing, public catalog reads, and replacement of sample inventory.
2. Booking workflow: persistent requests, price snapshots, agency inbox, traveler status, transactional capacity checks, and permissions.
3. Mobile delivery: shared feature extraction, mobile entry point, native auth adapters, Capacitor projects, build automation, and device validation.

Keep these stages sequential because the mobile release depends on a working marketplace. Each stage has focused implementation tasks and tests. Existing verification behavior must remain usable throughout.

## Verification

Run formatting, lint, type checking, relevant unit tests, application builds, integration tests against isolated Supabase, and web E2E workflows. Cover unauthorized access, package validation/publication, cross-agency references, server-derived totals, listing changes after submission, repeated submissions/decisions, two competing acceptances for the last seats, and cancellation capacity release.

E2E acceptance follows agency package creation/review/publication, traveler discovery/submission, agency acceptance/decline, and traveler status after re-login. Native device checks on Android and iPhone cover cold start, auth callbacks, session restoration, sign-out, navigation, media selection/upload, request submission and decision, connection loss/retry, and layouts with keyboard and safe areas.

## Build and release dependencies

The current Windows workspace has neither Android SDK nor Android Studio at the checked default paths. Install/configure the Android toolchain or use an Android CI runner before claiming an APK build. iOS compilation and signing require a Mac/Xcode or macOS CI runner. Prepare native projects and CI configuration here, then validate actual native outputs in the relevant build environments.

Production setup requires separate staging/production Supabase configuration, an HTTPS web/deep-link domain, applied migrations, authorized reviewer and agency memberships, and real published packages. Credentials stay outside source control. Distribution requires stable app identifiers, Android signing, and Apple signing/provisioning and developer account setup. A TestFlight build must be distinguished from App Store approval. Record these environment dependencies in release instructions; do not label them fulfilled without verification.

## Review boundary

The user has approved this written specification, including Android and iPhone delivery, real listings and booking requests, agency approval before confirmation, publication review, pricing rules, cancellation rules, agency-arranged payment, and native architecture. Implementation starts after implementation-plan review and execution-method selection under the selected workflow.
