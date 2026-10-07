# Mobile Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver live agency listings and agency-approved booking requests on the web and installable Android/iPhone apps.

**Architecture:** Extend the existing Supabase catalog with transactional publication and booking operations. Share platform-independent React feature screens between Next.js and a separate Vite/Capacitor mobile entry point, with separate routing and authentication adapters. Preserve hosted verification and administration.

**Tech Stack:** Existing Next.js 15, React 19, TypeScript, Supabase, Zod, Vitest, Playwright, pnpm 10.17.1; add Vite, React Router, Capacitor 8 and its App/Browser plugins, and `@aparajita/capacitor-secure-storage` with Capacitor 8-compatible versions locked during Task 8.

**Spec:** `docs/superpowers/specs/2026-10-07-mobile-marketplace-design.md` (user approved).

## Global Constraints

- A request becomes confirmed only after agency acceptance.
- Pending requests do not reserve seats.
- Acceptance confirms the original submitted terms and amount.
- Mobile code must not import Next.js server APIs, service-role clients, or database connection credentials.
- Bundle compiled assets locally in each native app.
- Never report a submitted request until the server confirms persistence; an ambiguous timeout keeps the same submission key for retry.
- Private verification documents stay in their existing private storage workflow.
- Credentials stay outside source control.
- Android installation and iPhone TestFlight installation must each pass device checks before the corresponding release is described as ready.
- Use `rtk` for shell commands. Run database integration tests only against an isolated local/staging Supabase environment.
- Keep existing currency/domain validation, verification, and server-dependent administration operational. Changes go in additive migrations.

## Review Focus

- A deleted price option after submission must not erase a request or change its amount: snapshot/restrict-reference integration test in Task 5.
- Extremely large prices multiplied by a group must fail safely rather than overflow JavaScript or SQL: total-boundary tests in Tasks 1 and 5.
- A decision from a stale inbox must refresh after a conflict, rather than overwrite another staff member: E2E in Task 7.
- A cold-start auth link, malformed URL, or duplicate callback must not exchange a code twice or redirect outside the app: tests in Task 8.
- A request timeout after database commit must recover the same request with the same key, rather than create two requests: E2E in Task 6.

## Execution and file boundaries

Use an isolated worktree at execution time under the Git Worktrees skill; keep the original worktree intact. Before installation, check Node/package-manager availability and resolve dependencies against official compatibility documentation. Do not rewrite the existing Next.js dependency stack.

Domain types and schemas live in `src/modules/catalog/` and `src/modules/bookings/`. Platform-independent Supabase services and React screens live in `src/features/catalog/` and `src/features/bookings/`. Next.js routes compose these features; `mobile/` owns Vite, native configuration, and mobile auth/routing. Keep `src/features/travel/components/travel-app.tsx` as the composition shell and split its existing large screen branches while replacing sample behavior.

All task verification commands below run from the repository root unless a working directory is specified. Use existing integration fixture helpers and add explicit fixture cleanup. Each task ends with a commit containing only its own changed files and an evidence note; use `rtk git add -- <listed paths>` and a task-specific `rtk git commit -m` message.

## Shared contracts

Task 1 defines the following public types in `src/modules/catalog/types.ts`:

- `CatalogFilters = { destinationId?: string; maxBudgetMinor?: number; travelers?: number; startsOn?: string; cursor?: string; limit: number }`, with limit 1–50, default 20; stable cursor uses created-at plus UUID.
- `CatalogCard = { id: string; agencyId: string; agencyName: string; slug: string; title: string; durationDays: number; currencyCode: string; fromAmountMinor: number; imagePath: string | null; destinationNames: string[] }`.
- `CatalogRate = { id: string; label: string; amountMinor: number; minTravelers: number; maxTravelers: number | null }`.
- `CatalogDeparture = { id: string; startsAt: string; endsAt: string; bookingCutoffAt: string; capacity: number; remainingCapacity: number }`.
- `CatalogDetail = CatalogCard & { version: number; overview: string; agencyDescription: string | null; agencyContactEmail: string | null; agencyContactPhone: string | null; pricingModel: 'per_person' | 'per_group' | 'tiered' | 'variant'; scheduleModel: 'fixed_departures' | 'open_dates'; minTravelers: number; maxTravelers: number; openDateWindow: { startsOn: string; endsOn: string } | null; rates: CatalogRate[]; departures: CatalogDeparture[]; itinerary: { dayNumber: number; title: string; description: string }[]; inclusions: string[]; exclusions: string[]; media: { id: string; storagePath: string; altText: string }[]; policies: PackagePublicationInput['policies'] }`.
- `PackageDraftInput = Omit<PackagePublicationInput, 'prices' | 'departures'> & { slug: string; prices: (PackagePublicationInput['prices'][number] & { id?: string })[]; departures: (PackagePublicationInput['departures'][number] & { id?: string })[] }`. Draft validation permits empty itinerary/rates/policies/overview while maintaining required database fields; full publication validation remains stricter. Media is managed separately by Task 4.

Task 5 defines these in `src/modules/bookings/types.ts`:

- `BookingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'`.
- `BookingInput = { packageId: string; rateId: string; departureId: string | null; startsOn: string | null; endsOn: string | null; adults: number; children: number; contactName: string; contactEmail: string; contactPhone: string; notes: string; submissionKey: string }`.
- `BookingSnapshot = { packageId: string; agencyId: string; agencyName: string; packageTitle: string; version: number; itinerary: CatalogDetail['itinerary']; policies: CatalogDetail['policies']; rateLabel: string; currencyCode: string; totalMinor: number }`.
- `BookingRecord = BookingInput & { id: string; travelerId: string; agencyId: string; status: BookingStatus; snapshot: BookingSnapshot; createdAt: string; decidedAt: string | null; decisionReason: string | null }`.
- `BookingEvent = { id: string; requestId: string; actorId: string; previousStatus: BookingStatus | null; status: BookingStatus; reason: string | null; createdAt: string }`.

Task 3 defines `MarketplaceNavigation = { openPackage(id: string): void; openTrips(): void; requireLogin(returnPath: string): void; openAgencyWorkspace(agencyId: string): void }` in `src/features/catalog/navigation.ts`. React screens take explicit client/navigation props and never create a platform-specific client internally.

### Task 1: Catalog query and price contracts

**Files:** Create `src/modules/catalog/types.ts`, `src/modules/catalog/pricing.ts`, `src/features/catalog/catalog-service.ts`, `supabase/migrations/202610070000_catalog_read.sql`, `tests/unit/catalog-pricing.test.ts`; create `tests/integration/helpers/catalog-fixtures.ts`, `tests/integration/catalog-read.test.ts`. Reuse `src/modules/catalog/package.ts`.

**Interfaces:** Produce `quotePackage(detail: CatalogDetail, rateId: string, adults: number, children: number): number`, SQL `search_published_packages(filters jsonb) returns jsonb` with `{ items: CatalogCard[], nextCursor: string | null }`, `listPublishedPackages(client: SupabaseClient, filters: CatalogFilters): Promise<{ items: CatalogCard[]; nextCursor: string | null }>`, and `getPackageDetail(client: SupabaseClient, id: string): Promise<CatalogDetail | null>`.

- [ ] Write failing unit cases: `quote_per_person_includes_children` asserts rate 125050 × (2 adults + 1 child) equals 375150; `quote_per_group_once` equals 125050; tiered/variant choices use the selected eligible rate per traveler. Ineligible/missing rates and unsafe totals throw. Use at least one adult and integer nonnegative children; total must meet package/rate limits.
- [ ] Run `rtk proxy node node_modules/vitest/vitest.mjs run tests/unit/catalog-pricing.test.ts`; confirm failures concern missing behavior.
- [ ] Define the shared contracts and implement quotes with safe integer arithmetic. Implement catalog reads with explicit selected columns, RLS, paginated filtering, batched relations, and currency-preserving display. Search applies destination, date and eligible-rate budget filters in SQL before pagination. Budget filtering compares the computed eligible total when traveler count is present. Without traveler count show a clearly labeled starting price. Initially remaining capacity equals capacity because no bookings exist; Task 5 connects detail reads to the new aggregate availability RPC.
- [ ] Write/run catalog integration cases proving only published packages from verified agencies are public, filters/cursors are stable, unauthorized draft reads return no data, and a query failure throws rather than returns samples. Run `rtk proxy node node_modules/vitest/vitest.mjs run tests/unit/catalog-pricing.test.ts tests/integration/catalog-read.test.ts` with local test credentials; expect all pass.
- [ ] Commit as `feat: add live catalog queries and price contracts`.

### Task 2: Transactional package editing and publication

**Files:** Create `supabase/migrations/202610070001_catalog_workflow.sql`, `src/features/catalog/catalog-management-service.ts`, `tests/integration/catalog-publication.test.ts`; modify `src/modules/catalog/package.ts` only for missing validation consistency.

**Interfaces:** Produce SQL `save_package_draft(target_agency_id uuid, target_package_id uuid, expected_version integer, package_input jsonb) returns uuid`, `submit_package_review(target_package_id uuid, expected_version integer) returns void`, `review_package(target_package_id uuid, expected_version integer, approve boolean, review_note text) returns void`, and `set_package_publication(target_package_id uuid, expected_version integer, target_status public.package_publication_status) returns void`. JSON draft input matches `PackageDraftInput`. Produce TS `savePackageDraft(client: SupabaseClient, agencyId: string, packageId: string | null, version: number | null, input: PackageDraftInput): Promise<string>`, `submitPackageReview(client: SupabaseClient, packageId: string, version: number): Promise<void>`, `reviewPackage(client: SupabaseClient, packageId: string, version: number, approve: boolean, reviewNote: string): Promise<void>`, and `setPackagePublication(client: SupabaseClient, packageId: string, version: number, status: 'published' | 'unpublished' | 'archived'): Promise<void>`. Produce `getPackageDraft(client: SupabaseClient, packageId: string): Promise<{ input: PackageDraftInput; version: number; status: string }>` and `listAgencyPackages(client: SupabaseClient, agencyId: string): Promise<{ id: string; title: string; version: number; status: string }[]>` for editor reads, restricted by existing RLS.

- [ ] Write failing DB tests for owner/manager/content-staff draft writes, denied outsiders/booking-staff writes, incomplete publication, verified-agency gating, first publication review by content-admin/super-admin, denied self-review, and expected-version conflicts.
- [ ] Run `rtk proxy node node_modules/vitest/vitest.mjs run tests/integration/catalog-publication.test.ts`; verify missing RPC failures.
- [ ] Add RPCs with fully qualified identifiers, empty search path, explicit auth checks, revoked public execution, authenticated grants, and server validation matching `packagePublicationInputSchema`. Save child relations transactionally, retain stable rate/departure IDs, increment version, and record review actor/time/note in a new `package_publication_events` table. Lock the package first. Persist drafts without exposing them; require complete data for review/publication.
- [ ] Reset isolated DB, run the publication and catalog-read integration suites; expect all pass. Ensure grants do not permit direct client publication/status writes.
- [ ] Commit as `feat: add controlled agency package publishing`.

### Task 3: Shared live traveler screens

**Files:** Create `src/features/catalog/navigation.ts`, `catalog-list.tsx`, `catalog-detail.tsx`, `catalog-state.tsx`; modify `src/features/travel/components/travel-app.tsx`, `src/features/travel/components/travel.css`, `src/features/travel/data.ts`; create `tests/e2e/live-catalog.spec.ts`.

**Interfaces:** Consume Task 1 services and expose `CatalogList({ client, navigation })`, `CatalogDetailScreen({ client, packageId, navigation, onRequest })`. `onRequest(detail: CatalogDetail): void` hands the selected package to Task 6. Existing demo helpers may remain only if explicitly isolated from the live entry point.

- [ ] Write failing E2E cases asserting a seeded real published package appears, destination/budget filtering works, unpublished inventory is absent, empty inventory shows an empty state, and network failure offers Retry without sample packages.
- [ ] Run `rtk proxy node node_modules/@playwright/test/cli.js test tests/e2e/live-catalog.spec.ts`; expect failures on the current sample interface.
- [ ] Extract list/detail screens, preserve the current visual language, and use explicit client/navigation injection. Remove sample match scores, mock agency names, and fabricated live availability. Render policies, eligible rate choices, real departures, loading/empty/error states, accessible labels, and starting-price basis.
- [ ] Run the new E2E cases plus `tests/e2e/home.spec.ts`; update prior sample assertions to real fixtures where applicable. Expect pass at desktop and phone viewport widths.
- [ ] Commit as `feat: connect traveler screens to published inventory`.

### Task 4: Agency editor, catalog media, and review workspace

**Files:** Create `src/features/catalog/package-editor.tsx`, `agency-package-list.tsx`, `publication-review.tsx`, `catalog-media.ts`; create `src/app/agency/[agencyId]/packages/page.tsx`, `src/app/agency/[agencyId]/packages/[packageId]/page.tsx`, `src/app/admin/packages/page.tsx`; create `supabase/migrations/202610070002_catalog_media.sql`; create `tests/integration/catalog-media.test.ts`, `tests/e2e/package-publication.spec.ts`.

**Interfaces:** Consume Task 2 mutations; produce `PackageEditor({ client, agencyId, packageId, onSaved })`, `AgencyPackageList({ client, agencyId, onOpen })`, and `uploadPackageImage(client: SupabaseClient, packageId: string, file: File, altText: string): Promise<string>`. SQL media interfaces: `register_package_media(target_package_id uuid, target_media_id uuid, target_storage_path text, target_alt_text text) returns uuid`, `remove_package_media(target_media_id uuid) returns text` returning the removable storage path; check agency roles and storage-object ownership. Media registration requires an existing uploaded object; failed registration removes the orphan object where authorized.

- [ ] Write failing media integration cases for denied foreign-agency paths, unpublished-image access by guests, mismatched MIME/extension, and files exceeding 5 MiB. Write failing E2E for complete package entry, first review, requested changes, approval, subsequent publish, and unpublish.
- [ ] Run both focused suites to confirm expected failures.
- [ ] Implement editor fields from the existing domain schema, stable child IDs, draft saving, actionable validation, and optimistic version conflict refresh. Use a private `package-media` bucket with policies for agency editors and published/verified guest reads; create short-lived signed URLs only after visibility checks. Permit JPEG/PNG/WebP up to 5 MiB, generated agency/package/object paths, required alt text, and registration/removal RPCs. Recheck publication at each signed URL issuance; cached signed URLs expire within 60 seconds after removal/unpublish.
- [ ] Add content-admin/super-admin hosted review queue and detail with review notes, complete package preview, and gated decisions. Use existing server-auth helpers for admin pages. Run media/publication E2E and existing agency verification regression suites; expect pass.
- [ ] Commit as `feat: add agency catalog editing and publication review`.

### Task 5: Booking persistence and atomic decisions

**Files:** Create `src/modules/bookings/types.ts`, `request.ts`, `src/features/bookings/booking-service.ts`, `supabase/migrations/202610070003_booking_workflow.sql`, `tests/unit/booking-input.test.ts`, `tests/integration/booking-workflow.test.ts`.

**Interfaces:** Produce SQL `submit_booking_request(request_input jsonb) returns uuid`, `decide_booking_request(target_request_id uuid, target_status public.booking_request_status, reason text) returns void`, `cancel_booking_request(target_request_id uuid, reason text) returns void`, and `get_departure_availability(target_package_id uuid) returns table(departure_id uuid, remaining_capacity integer)`. Produce `submitBookingRequest(client: SupabaseClient, input: BookingInput): Promise<BookingRecord>`, `listMyRequests(client): Promise<BookingRecord[]>`, `listAgencyRequests(client, agencyId: string, status?: BookingStatus): Promise<BookingRecord[]>`, `getRequestEvents(client, requestId: string): Promise<BookingEvent[]>`, `decideRequest(client, requestId, decision: 'accepted' | 'declined', reason: string): Promise<void>`, and `cancelRequest(client, requestId, reason: string): Promise<void>`.

- [ ] Write failing tests for identity/price tampering, rate/departure cross-package references, invalid dates/counts, integer-overflow totals, denied unrelated travelers/content staff, empty decline reason, and old snapshot preservation after rate deletion/package edits.
- [ ] Run focused unit/integration tests, confirming missing workflow failures.
- [ ] Implement schemas, RLS, tables, snapshots, and append-only events. Snapshot server-calculated terms and price; use selected row's rate per person for per-person/tiered/variant and once for per-group. Use at least one adult, nonnegative children, valid group bounds, trimmed contact name/phone/email, notes ≤2000 characters, and UUID submission key. Fixed departures derive dates from the departure; open-date duration counts calendar days in Asia/Manila, inclusive, matching package duration.
- [ ] Implement idempotency and row locks. Acquire agency then package then departure (if any) then request locks consistently across submission/decision/cancellation and catalog edits; when a transaction affects multiple departures lock them in UUID order. Recheck verification/publication/cutoff. Serialize capacity totals against accepted records. Patch Task 2 editing guards to reject departure removal/time changes with accepted bookings and reductions below confirmed occupancy. Use restrict deletion for historical package/agency/departure/rate references and preserve snapshot records. Guests see only aggregated remaining capacity through the availability RPC, never traveler rows. Update `getPackageDetail` to use this RPC and verify the revised read tests against accepted/cancelled requests.
- [ ] Add concurrency tests: two independent clients accepting requests for the last seats yield one acceptance, repeated decision creates one event, retries with identical submission key return one request, altered payload with the same key returns conflict, cancellation releases capacity, suspended agency blocks acceptance but permits decline/cancellation, and pending requests consume zero seats. Run all booking/catalog integration suites; expect pass.
- [ ] Commit as `feat: persist and approve booking requests atomically`.

### Task 6: Traveler request form and My Trips

**Files:** Create `src/features/bookings/request-form.tsx`, `my-trips.tsx`, `request-detail.tsx`, `request-draft.ts`; modify `src/features/travel/components/travel-app.tsx`; create `tests/e2e/traveler-bookings.spec.ts`.

**Interfaces:** Consume Tasks 1/5. Produce `RequestForm({ client, detail, navigation, onSubmitted })`, `MyTrips({ client, onOpenRequest })`, and `RequestDetail({ client, requestId })`. Retain submission UUID until definitive success or explicit new request; browser draft storage retains selection/key only, never private contact details.

- [ ] Write failing E2E for login/return path, explicit price/date/count selection, pending status after submission and re-login, accepted/declined status, original terms after a listing edit, and pending cancellation.
- [ ] Add an intercepted timeout-after-server-commit test: retry preserves submission key, one request exists, and My Trips resolves the persisted request. Run the focused suite; expect failures on preview behavior.
- [ ] Replace preview-save modal with the live request form, explain that pending requests reserve no seats, show original quotation/terms before submit, and report success only after server persistence. Use server errors with retry and keep draft/key for ambiguous outcomes. My Trips uses persisted records and events and clearly distinguishes Confirmed from payment received.
- [ ] Run traveler-booking E2E and existing login/home tests; expect pass.
- [ ] Commit as `feat: add traveler booking requests and trip status`.

### Task 7: Agency request inbox and decisions

**Files:** Create `src/features/bookings/agency-inbox.tsx`, `agency-request-detail.tsx`, `src/app/agency/[agencyId]/requests/page.tsx`, `src/app/agency/[agencyId]/requests/[requestId]/page.tsx`; create `tests/e2e/agency-bookings.spec.ts`.

**Interfaces:** Consume Task 5. Produce `AgencyInbox({ client, agencyId, onOpenRequest })`, `AgencyRequestDetail({ client, agencyId, requestId, onChanged })`; expose refresh/filter controls usable by web and mobile.

- [ ] Write failing E2E for owner/manager/booking-staff inbox access, denied content/read-only staff access to contacts, accept/decline with explanation, confirmed cancellation reason, and traveler-visible events.
- [ ] Add stale-inbox test: two staff load one pending request; first accepts, second declines; second sees refreshed confirmed status and conflict without overwriting acceptance. Run focused suite to confirm missing behavior.
- [ ] Implement explicit loading/empty/error states, detail with snapshotted amount/terms/contact, confirmation dialogs, and server-driven statuses. Require decline/cancellation reasons, disable duplicate actions during requests, and refresh after conflict. Gate server routes and retain database enforcement.
- [ ] Run agency and traveler booking E2E together against isolated fixtures; expect pass. Commit as `feat: add agency request inbox and booking decisions`.

### Task 8: Mobile bundle, secure auth, and native projects

**Files:** Create `mobile/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `capacitor.config.ts`, `.env.example`, `src/main.tsx`, `src/app.tsx`, `src/auth/native-client.ts`, `src/auth/secure-storage.ts`, `src/auth/auth-links.ts`, `src/auth/auth-screen.tsx`, `src/navigation.ts`; generate `mobile/android/` and `mobile/ios/`; create `pnpm-workspace.yaml`; modify root `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.gitignore`, `eslint.config.mjs`, `.prettierignore`; create `tests/unit/native-auth-links.test.ts`, `native-storage.test.ts`, `tests/e2e/mobile-marketplace.spec.ts`, `playwright.mobile.config.ts`.

**Interfaces:** Consume shared screens/services/navigation. Produce `createNativeSupabaseClient(): SupabaseClient`, storage `getItem(key: string): Promise<string | null>`, `setItem(key: string, value: string): Promise<void>`, `removeItem(key: string): Promise<void>`, and `handleAuthLink(url: string): Promise<'handled' | 'ignored'>`. Native config uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_ORIGIN`, `VITE_AUTH_CALLBACK_URL`, plus build-time `GIYAHERO_APP_ID` and `GIYAHERO_APP_NAME`.

- [ ] Write failing unit tests for valid callback parsing, hostile origin/path, missing/error code, duplicate callback, cold-start handling, safe return path, secure storage missing key, sign-out removal, and fail-closed native storage errors. Run those focused tests and confirm failures.
- [ ] Create the workspace mobile package with compatible locked versions, Node ≥22, React 19, Vite/React Router, Capacitor 8 core/CLI/Android/iOS/App/Browser, and secure-storage plugin. Keep Next type checking separate from mobile and add `mobile:build`, `mobile:typecheck`, `mobile:sync`, `mobile:android`, `mobile:ios` scripts. Set Capacitor `webDir` to `dist`; no production remote `server.url`. Build scripts fail clearly when mandatory public configuration is absent.
- [ ] Implement secure storage using the plugin on native only with iCloud sync disabled; web preview uses an explicit development adapter and never claims native security. Configure Supabase PKCE with manual callback exchange and no URL autodetection in native. Open OAuth in the system browser, process App launch URL and URL events, deduplicate callbacks, restore sessions, and clear stored sessions on sign-out. Email confirmation on another device offers normal sign-in when the original verifier is unavailable. Keep `/mobile/auth/callback` distinct from the existing server `/auth/callback`.
- [ ] Compose shared catalog, traveler requests, agency catalog editor and inbox in mobile routing. Connect login, history/back, safe areas, keyboard, image upload, external links and hosted verification/admin links. Add branded icons/splash assets from the existing logo. Generate native platform projects and set deep-link entitlements/intent filters from release config, with distinct staging/production app identifiers.
- [ ] Add mobile-web E2E config at port 5173 and run listing → request → agency decision → My Trips with real isolated Supabase fixtures. Run mobile build/typecheck, native sync, and native auth/storage unit suites. Browser preview success is recorded separately from device tests. Commit as `feat: package shared marketplace for Android and iOS`.

### Task 9: Native CI, environment setup, and release validation

**Files:** Create `.github/workflows/mobile.yml`, `scripts/mobile/check-release-config.mjs`, `scripts/mobile/write-link-associations.mjs`, `docs/operations/mobile-release.md`; modify `.github/workflows/ci.yml`, `docs/operations/environments.md`, `docs/operations/deployment.md`; generate deployment association files from approved release configuration, never invented production identities.

**Interfaces:** Produce config validator that rejects missing domain/app ID, Apple team ID, Android SHA-256 signing fingerprint, invalid origins, or absent public Supabase settings. Association generator writes Android `assetlinks.json` and Apple `apple-app-site-association` for the configured app identifiers and `/mobile/auth/callback` path; deployment serves both under `/.well-known/` with the required content types and no auth/redirect interception.

- [ ] Write/run failing validator tests for HTTP production origin, missing signing identity, malformed fingerprint, and mismatched callback origin. Implement validation/generation and confirm pass.
- [ ] Extend CI for mobile typecheck/bundle and native builds: Android Linux runner with SDK/JDK supported by Capacitor 8 runs Gradle debug assembly and retains APK; macOS runner performs unsigned iOS simulator build. Configure signed AAB/archive/TestFlight jobs only when actual credentials and provisioning are supplied. Keep secrets in CI environments. Do not trigger production distribution without release authorization.
- [ ] Run `rtk proxy node node_modules/prettier/bin/prettier.cjs --check .`, lint, web/mobile typecheck, unit tests, web/mobile builds, isolated DB integration tests, and web/mobile E2E. Record actual commands/results; resolve failures before full-branch review. Preserve existing verification tests.
- [ ] Record native evidence: Android APK assembly/install and device checks; iOS simulator compile plus signed TestFlight build/install on iPhone. Verify cold launch, session restore, auth callbacks, sign-out, back/keyboard/safe areas, image upload, request timeout recovery, agency acceptance, and server status after restart. If SDK/macOS/signing/domain credentials are absent, document exact unfinished checks and continue all independent preparation; do not mark the release complete.
- [ ] Review the whole branch under the selected execution method. Commit release documentation/configuration after evidence is recorded. Provide artifact paths and explicitly separate generated source, debug APK, unsigned iOS build, signed TestFlight availability, and store publication.

## Environment inputs and release boundary

Code/config preparation does not require production secrets. Live deployment and distribution depend on user-owned staging/production Supabase projects, HTTPS deep-link domain, final reverse-domain app IDs, Apple developer/team/provisioning details, Android signing key/fingerprint, and Android/macOS build environments. Ask for required non-secret identifiers at the stage that needs them; route secrets through environment/CI configuration.

The plan preserves the approved agency-arranged-payment and agency-approval scope. Native toolchain compatibility and storage choices are grounded in [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), [secure-storage plugin documentation](https://github.com/aparajita/capacitor-secure-storage), and [Supabase PKCE documentation](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Self-review and handoff

Coverage: Tasks 1–4 cover public catalog, editor, media and publication; Tasks 5–7 cover prices, persistence, privacy, capacity, history and decisions; Tasks 8–9 cover platform adapters, secure sessions, links, native outputs and release evidence. Every Review Focus condition has a named test in its owning task. Shared signatures/types match consumers; tasks remain sequential where database and UI contracts depend on each other.

Recommended execution: Native implementation in this session, followed by a fresh whole-branch reviewer. The tasks share database and screen interfaces; one implementer minimizes handoff overhead. Subagent-driven implementation with independent review after each task is available if preferred. Written-plan review and execution-method selection are required before product implementation under the Writing Plans workflow.
