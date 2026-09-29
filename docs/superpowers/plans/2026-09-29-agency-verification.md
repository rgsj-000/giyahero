# Agency Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure manual agency verification workflow from agency document submission through authorized GiyaHero review and atomic verification decision.

**Architecture:** Extend the existing Supabase agency foundation instead of introducing parallel identity or organization models. PostgreSQL RPCs own all verification state transitions, Supabase Storage keeps evidence private, and Next.js App Router screens consume those boundaries for agency and admin workflows. Client-side state improves usability, but authorization and lifecycle integrity remain enforced by RLS, storage policies, and database functions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.9, Supabase Auth/Postgres/Storage, `@supabase/ssr`, `@supabase/supabase-js`, Tailwind CSS 4, Vitest 3, Playwright 1.55, pnpm 10.17.1.

**Spec:** `docs/superpowers/specs/2026-09-29-agency-verification-design.md`

## Global Constraints

- Reuse `agencies`, `agency_members`, `platform_admin_memberships`, `agency_verification_submissions`, and `agency_verification_documents`; do not create duplicate domain tables.
- GiyaHero verification is a platform trust decision and must remain distinct from DOT or other government accreditation.
- Required Release 1 document types are `business_registration`, `business_permit`, and `authorized_representative_id`; `dot_accreditation` is optional.
- Only agency `owner` and `manager` roles may prepare and submit verification applications.
- Only platform `super_admin` and `agency_verifier` roles may start reviews or decide applications.
- Verification evidence must live in the private `agency-verification` storage bucket and must never receive permanent public URLs.
- Verification mutations must flow through narrowly scoped security-definer RPCs; UI visibility is not an authorization boundary.
- A verification submission is editable only in `draft`; `submitted`, `under_review`, `verified`, and `rejected` submissions are immutable to agency users.
- Rejected agencies cannot create a new verification application in Release 1.
- No OCR, AI extraction, government registry integration, automatic expiry monitoring, or reverification scheduling in Release 1.
- Do not add product dependencies unless a task explicitly requires one; the current dependency set is sufficient.

## Review Focus

- Malformed or hostile filenames such as `../../permit.pdf` must be sanitized before they become object paths; Task 2 pins this with unit tests.
- Concurrent or stale lifecycle actions must fail rather than double-submit, double-review, or overwrite a terminal decision; Task 1 pins this with integration tests.
- Malformed storage paths must not crash policy evaluation or grant cross-agency access; Task 2 pins this with integration tests.
- Whitespace-only rejection notes must be rejected at the RPC boundary even if the UI attempts to submit them; Task 1 pins this with integration tests.
- A verifier must be able to read an unverified agency for review without making that agency public to travelers; Task 1 pins both sides of that policy with integration tests.

---

## File Structure

### Database and storage

- Create `supabase/migrations/202609290003_agency_verification_workflow.sql` — lifecycle enum adjustment, verification RPCs, admin agency-read policy, draft uniqueness, document category constraints.
- Create `supabase/migrations/202609290004_agency_verification_storage.sql` — private bucket configuration and storage object policies.
- Create `tests/unit/agency-verification-migration.test.ts` — structural assertions against migration SQL.
- Create `tests/integration/agency-verification-workflow.test.ts` — real database state-transition and role tests.
- Create `tests/integration/agency-verification-storage.test.ts` — private bucket and cross-role storage access tests.
- Create `tests/integration/helpers/verification-fixtures.ts` — reusable test-user, agency, role, and authenticated Supabase client fixtures.

### Shared verification feature

- Create `src/features/agencies/verification/document-types.ts` — document type metadata and required/optional flags.
- Create `src/features/agencies/verification/storage-path.ts` — filename sanitization and private object path construction.
- Create `src/features/agencies/verification/types.ts` — UI-facing verification models shared by agency and admin screens.
- Create `tests/unit/agency-verification-domain.test.ts` — completeness and path helper tests.

### Agency experience

- Create `src/app/agency/[agencyId]/verification/page.tsx` — authenticated server route and initial data loading.
- Create `src/features/agencies/verification/agency-verification-workspace.tsx` — draft upload, replacement/removal, submission, and terminal status UI.
- Create `src/features/agencies/verification/document-card.tsx` — one document category upload/status control.
- Create `tests/e2e/agency-verification.spec.ts` — agency-facing verification behavior.

### Admin experience

- Create `src/app/admin/verifications/page.tsx` — verifier-only queue route.
- Create `src/app/admin/verifications/[submissionId]/page.tsx` — verifier-only review route.
- Create `src/features/agencies/verification/admin-verification-queue.tsx` — queue presentation and filtering.
- Create `src/features/agencies/verification/admin-verification-review.tsx` — secure document access and decision controls.
- Create `tests/e2e/admin-verification.spec.ts` — verifier queue and review behavior.

### End-to-end test support

- Create `tests/e2e/helpers/verification-auth.ts` — deterministic authenticated browser setup using test users provisioned through the service-role client.
- Modify `tests/e2e/agency-onboarding.spec.ts` only if the new authenticated journey needs to assert the existing post-create redirect more precisely.

---

### Task 1: Verification State Machine and Authorization RPCs

**Files:**
- Create: `supabase/migrations/202609290003_agency_verification_workflow.sql`
- Create: `tests/unit/agency-verification-migration.test.ts`
- Create: `tests/integration/helpers/verification-fixtures.ts`
- Create: `tests/integration/agency-verification-workflow.test.ts`

**Interfaces:**
- Consumes: existing `public.has_agency_role(uuid, agency_member_role[])`, `public.has_platform_admin_role(platform_admin_role[])`, `agencies`, `agency_members`, `platform_admin_memberships`, `agency_verification_submissions`, and `agency_verification_documents`.
- Produces:
  - `public.create_verification_draft(target_agency_id uuid) returns uuid`
  - `public.register_verification_document(target_submission_id uuid, target_document_id uuid, target_document_type text, target_storage_path text, target_original_name text, target_mime_type text, target_size_bytes bigint) returns uuid`
  - `public.remove_verification_document(target_document_id uuid) returns text`
  - `public.submit_agency_verification(target_submission_id uuid) returns void`
  - `public.start_agency_verification_review(target_submission_id uuid) returns void`
  - `public.decide_agency_verification(target_submission_id uuid, target_decision public.agency_verification_status, target_notes text default null) returns void`
  - `agency_verification_status` values exactly `draft`, `submitted`, `under_review`, `verified`, `rejected`.

- [ ] **Step 1: Write the migration structure tests**

In `tests/unit/agency-verification-migration.test.ts`, assert that the concatenated migration SQL contains all six RPC names, a private workflow status including `draft`, a partial uniqueness rule preventing multiple drafts for one agency, grants only to `authenticated`, and no direct permissive insert/update/delete policy on verification tables.

- [ ] **Step 2: Run the migration structure test and verify it fails**

Run: `pnpm exec vitest run tests/unit/agency-verification-migration.test.ts`

Expected: FAIL because `202609290003_agency_verification_workflow.sql` and the required RPCs do not exist.

- [ ] **Step 3: Write failing workflow integration tests**

In `tests/integration/agency-verification-workflow.test.ts`, use fixtures from `tests/integration/helpers/verification-fixtures.ts` to prove:

1. owner and manager can create/resume one draft;
2. `booking_staff`, unrelated authenticated users, and anonymous clients cannot create or mutate a draft;
3. two concurrent draft requests resolve to the same editable submission rather than producing duplicates;
4. required categories block submission until all three required document rows exist;
5. submitting sets `submission.status = 'submitted'`, `submitted_at`, and `agency.status = 'submitted'` together;
6. an agency user cannot mutate documents after submission;
7. only `agency_verifier` or `super_admin` can start review;
8. starting review sets both submission and agency to `under_review`;
9. only `under_review` can be decided;
10. `rejected` with `"   "` notes fails;
11. approval sets both statuses to `verified` and records `agencies.verified_at` plus reviewer/timestamp;
12. rejection sets both statuses to `rejected`, records trimmed notes, and leaves `verified_at` null;
13. a second decision attempt fails without changing the first decision;
14. a rejected agency cannot create a fresh draft;
15. verifier roles can read an unverified agency while anonymous and unrelated authenticated users still cannot.

- [ ] **Step 4: Run the workflow integration test and verify it fails**

Run: `pnpm exec vitest run tests/integration/agency-verification-workflow.test.ts`

Expected: FAIL because draft status and workflow RPCs do not exist.

- [ ] **Step 5: Implement the lifecycle migration and RPCs**

In `supabase/migrations/202609290003_agency_verification_workflow.sql`:

- replace/upgrade the verification enum so `draft` can be used immediately and existing values remain valid;
- make `submitted_at` nullable and remove its automatic default;
- default new verification submissions to `draft`;
- add a partial unique index allowing at most one `draft` per agency;
- add a unique constraint/index on `(submission_id, document_type)` so one active document represents each category;
- constrain supported `document_type` values to the four Release 1 identifiers;
- add an agency SELECT policy for `super_admin` and `agency_verifier` without widening anonymous/public visibility;
- implement the six RPC signatures above as `security definer` functions with `set search_path = ''`;
- derive agency identity from the submission where possible instead of trusting caller-supplied agency IDs;
- require `owner` or `manager` for agency mutations and `super_admin` or `agency_verifier` for review actions;
- validate `target_storage_path` starts with `agency/{agencyId}/{submissionId}/{target_document_id}/` before registering metadata;
- trim rejection notes and reject empty results;
- update submission and agency status inside the same database transaction provided by each RPC call;
- revoke public function access and grant execute only to `authenticated`.

For the draft race, handle the partial unique-index conflict by re-reading and returning the already-created draft.

- [ ] **Step 6: Run migration unit and workflow integration tests**

Run:

```bash
pnpm exec vitest run tests/unit/agency-verification-migration.test.ts
pnpm exec vitest run tests/integration/agency-verification-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add supabase/migrations/202609290003_agency_verification_workflow.sql tests/unit/agency-verification-migration.test.ts tests/integration/helpers/verification-fixtures.ts tests/integration/agency-verification-workflow.test.ts
git commit -m "feat: add agency verification workflow"
```

---

### Task 2: Private Verification Document Storage

**Files:**
- Create: `supabase/migrations/202609290004_agency_verification_storage.sql`
- Create: `src/features/agencies/verification/document-types.ts`
- Create: `src/features/agencies/verification/storage-path.ts`
- Create: `src/features/agencies/verification/types.ts`
- Create: `tests/unit/agency-verification-domain.test.ts`
- Create: `tests/integration/agency-verification-storage.test.ts`

**Interfaces:**
- Consumes: Task 1 draft submission and role rules.
- Produces:
  - `type VerificationDocumentType = "business_registration" | "business_permit" | "authorized_representative_id" | "dot_accreditation"`
  - `VERIFICATION_DOCUMENT_TYPES: readonly VerificationDocumentDefinition[]`
  - `getVerificationCompleteness(documents: readonly { document_type: string }[]): { complete: boolean; missingRequired: VerificationDocumentType[] }`
  - `sanitizeVerificationFilename(filename: string): string`
  - `buildVerificationStoragePath(input: { agencyId: string; submissionId: string; uploadId: string; filename: string }): string`
  - private Supabase bucket `agency-verification`.

- [ ] **Step 1: Write failing domain helper tests**

In `tests/unit/agency-verification-domain.test.ts`, assert:

- the three required identifiers are required and `dot_accreditation` is optional;
- completeness is false when any required type is missing and true when all three are present;
- duplicate document rows do not change completeness;
- `sanitizeVerificationFilename("../../Mayor's Permit 2026.PDF")` contains no `/`, `\\`, or `..` and preserves a safe `.pdf` extension;
- blank/fully-invalid filenames fall back to a deterministic safe basename;
- `buildVerificationStoragePath` returns `agency/{agencyId}/{submissionId}/{uploadId}/{sanitizedFilename}` exactly.

- [ ] **Step 2: Run the domain helper test and verify it fails**

Run: `pnpm exec vitest run tests/unit/agency-verification-domain.test.ts`

Expected: FAIL because the verification domain modules do not exist.

- [ ] **Step 3: Implement document metadata and storage path helpers**

Implement the interfaces above. Keep the definitions data-only so both agency and admin UI can render labels from the same source. Filename sanitization must remove path separators/control characters, collapse unsafe runs to `-`, cap the final name to a reasonable length, and never return an empty filename.

- [ ] **Step 4: Run the domain helper test and verify it passes**

Run: `pnpm exec vitest run tests/unit/agency-verification-domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing storage integration tests**

In `tests/integration/agency-verification-storage.test.ts`, prove:

1. the bucket exists and `public = false`;
2. anonymous and unrelated authenticated clients cannot read or upload objects;
3. owner and manager can upload only below `agency/{ownAgencyId}/{draftSubmissionId}/...`;
4. malformed paths such as `agency/not-a-uuid/...`, truncated paths, and another agency ID are denied without granting access;
5. owner/manager can read their own evidence after submission but cannot delete it once the submission leaves `draft`;
6. `agency_verifier` and `super_admin` can read evidence for submitted/under-review applications;
7. non-verifier platform roles cannot read evidence.

- [ ] **Step 6: Run the storage integration test and verify it fails**

Run: `pnpm exec vitest run tests/integration/agency-verification-storage.test.ts`

Expected: FAIL because the private bucket and policies do not exist.

- [ ] **Step 7: Implement the storage migration**

In `supabase/migrations/202609290004_agency_verification_storage.sql`:

- insert/update bucket `agency-verification` with `public = false`;
- limit accepted evidence to PDF, JPEG, PNG, and WebP with a 10 MiB per-object limit;
- add `storage.objects` INSERT policy for owner/manager only when the path maps to their own `draft` submission;
- add SELECT policy for owner/manager on their agency evidence and for `super_admin`/`agency_verifier` on review evidence;
- add DELETE policy only for owner/manager while the mapped submission is `draft`;
- do not add anonymous policies;
- compare folder segments as text against IDs from database rows rather than blindly casting untrusted folder segments to UUID, so malformed paths deny safely instead of raising policy errors.

- [ ] **Step 8: Run Task 2 tests**

Run:

```bash
pnpm exec vitest run tests/unit/agency-verification-domain.test.ts
pnpm exec vitest run tests/integration/agency-verification-storage.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add supabase/migrations/202609290004_agency_verification_storage.sql src/features/agencies/verification tests/unit/agency-verification-domain.test.ts tests/integration/agency-verification-storage.test.ts
git commit -m "feat: secure agency verification documents"
```

---

### Task 3: Agency Verification Workspace

**Files:**
- Create: `src/app/agency/[agencyId]/verification/page.tsx`
- Create: `src/features/agencies/verification/agency-verification-workspace.tsx`
- Create: `src/features/agencies/verification/document-card.tsx`
- Create: `tests/e2e/agency-verification.spec.ts`
- Create: `tests/e2e/helpers/verification-auth.ts`

**Interfaces:**
- Consumes: Task 1 RPCs; Task 2 document definitions, path builder, private bucket; existing `createServerSupabaseClient()` and `createBrowserSupabaseClient()`.
- Produces: authenticated route `/agency/[agencyId]/verification` and agency-facing upload/submission workflow.

- [ ] **Step 1: Write the failing agency E2E tests**

In `tests/e2e/agency-verification.spec.ts`, provision an agency owner through `tests/e2e/helpers/verification-auth.ts`, authenticate through the browser, and assert:

- owner can open `/agency/{agencyId}/verification`;
- the page shows Business Registration, Current Business Permit, Authorized Representative ID as Required and DOT Accreditation as Optional;
- Submit for Verification is disabled while required categories are missing;
- after uploading the three required files, each filename/status appears and Submit becomes enabled;
- a filename containing traversal-like characters is displayed safely and stored under the expected private path shape;
- removing a draft file makes the application incomplete again;
- submitting changes the UI to `Submitted` and removes/disables upload, replace, and remove controls;
- a non-manager agency role cannot use verification mutation controls and does not receive sensitive application contents.

Use small test fixture files generated within the test process; do not add real identity or permit documents to the repository.

- [ ] **Step 2: Run the agency E2E test and verify it fails**

Run: `pnpm exec playwright test tests/e2e/agency-verification.spec.ts`

Expected: FAIL because the route and components do not exist.

- [ ] **Step 3: Implement the authenticated server route**

In `src/app/agency/[agencyId]/verification/page.tsx`:

- require an authenticated user through the server Supabase client;
- fetch the current user's membership for `agencyId` and allow the verification workspace only for `owner` or `manager`;
- fetch the agency and latest/current verification submission through RLS-protected queries;
- when the agency is `draft` and no submission exists, call idempotent `create_verification_draft(agencyId)` and load that draft;
- do not create a new draft for `submitted`, `under_review`, `verified`, or `rejected` agencies;
- load document metadata for the current submission;
- pass a serializable initial model to `AgencyVerificationWorkspace`.

Unauthorized access should redirect to `/agency/onboarding` or render not-found without revealing another agency's verification state.

- [ ] **Step 4: Implement `DocumentCard`**

`DocumentCard` receives one `VerificationDocumentDefinition`, its current document metadata or `null`, submission editability, and callbacks for upload/replace/remove. It owns presentation only; storage/RPC work remains in the workspace.

- [ ] **Step 5: Implement `AgencyVerificationWorkspace`**

The client component must:

- render the status banner, checklist, document cards, submission summary, and decision state;
- generate `uploadId` with `crypto.randomUUID()`;
- build the path with `buildVerificationStoragePath(...)`;
- upload to bucket `agency-verification` before calling `register_verification_document(...)`;
- if metadata registration fails after upload, attempt best-effort deletion of that just-uploaded object and show a recoverable error;
- for removal, delete the storage object first, then call `remove_verification_document(documentId)`; if metadata removal fails, show an explicit repair/retry error rather than claiming success;
- compute completeness with `getVerificationCompleteness(...)`;
- call `submit_agency_verification(submissionId)` only from draft state;
- `router.refresh()` after successful state transitions so the server route remains the canonical source of lifecycle state;
- use authenticated short-lived signed URLs for any evidence view action; never create public URLs.

- [ ] **Step 6: Run the agency E2E test**

Run: `pnpm exec playwright test tests/e2e/agency-verification.spec.ts`

Expected: PASS.

- [ ] **Step 7: Run focused type/lint checks**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add src/app/agency/[agencyId]/verification src/features/agencies/verification tests/e2e/agency-verification.spec.ts tests/e2e/helpers/verification-auth.ts
git commit -m "feat: add agency verification workspace"
```

---

### Task 4: Admin Verification Queue and Review Decision UI

**Files:**
- Create: `src/app/admin/verifications/page.tsx`
- Create: `src/app/admin/verifications/[submissionId]/page.tsx`
- Create: `src/features/agencies/verification/admin-verification-queue.tsx`
- Create: `src/features/agencies/verification/admin-verification-review.tsx`
- Create: `tests/e2e/admin-verification.spec.ts`

**Interfaces:**
- Consumes: Task 1 verifier read policy and review/decision RPCs; Task 2 private storage SELECT policy; shared verification document definitions.
- Produces: `/admin/verifications` and `/admin/verifications/[submissionId]` restricted to `super_admin` and `agency_verifier`.

- [ ] **Step 1: Write failing admin E2E tests**

In `tests/e2e/admin-verification.spec.ts`, provision a submitted application and platform users with different roles, then assert:

- `agency_verifier` can open `/admin/verifications` and see the submitted agency;
- `super_admin` can do the same;
- `moderator`, ordinary authenticated user, and anonymous visitor cannot access the queue;
- opening the review page shows agency profile fields, submitted timestamp, document category labels, and secure evidence actions;
- Start Review changes status to `Under review`;
- Reject Agency requires a non-whitespace reason and a confirmed rejection displays the saved notes to the agency user;
- Verify Agency requires explicit confirmation and changes the agency to `Verified`;
- after a terminal decision, decision buttons disappear and a stale second decision cannot overwrite the result.

Use separate seeded submissions for approval and rejection scenarios so terminal state does not make tests order-dependent.

- [ ] **Step 2: Run the admin E2E test and verify it fails**

Run: `pnpm exec playwright test tests/e2e/admin-verification.spec.ts`

Expected: FAIL because admin verification routes do not exist.

- [ ] **Step 3: Implement the admin queue route and component**

`src/app/admin/verifications/page.tsx` must:

- require authentication;
- query the current user's `platform_admin_memberships` through existing self-read RLS;
- admit only `super_admin` and `agency_verifier`;
- fetch `submitted` and `under_review` submissions with associated agency name and document count;
- order action-needed items by `submitted_at` ascending;
- pass serializable rows to `AdminVerificationQueue`.

`AdminVerificationQueue` renders agency name, submitted date, status, document count, and a Review link. Add only simple Submitted / Under review / All filtering; no bulk actions or advanced search.

- [ ] **Step 4: Implement the admin review route**

`src/app/admin/verifications/[submissionId]/page.tsx` must apply the same verifier role gate, fetch the submission, its agency, and its document metadata, and render `AdminVerificationReview`. Missing/inaccessible submissions use not-found behavior rather than leaking record existence.

- [ ] **Step 5: Implement `AdminVerificationReview`**

The client component must:

- render agency details and all document categories;
- create only short-lived signed URLs from the private bucket when a verifier explicitly selects View document;
- expose Start Review only for `submitted`;
- expose Verify Agency and Reject Agency only for `under_review`;
- require confirmation before approval;
- require trimmed non-empty notes before rejection in the UI while still relying on the RPC for authoritative validation;
- call `start_agency_verification_review(...)` and `decide_agency_verification(...)` directly through the authenticated browser client;
- refresh route data after each successful transition;
- display RPC/storage errors without optimistic status changes.

- [ ] **Step 6: Run the admin E2E test**

Run: `pnpm exec playwright test tests/e2e/admin-verification.spec.ts`

Expected: PASS.

- [ ] **Step 7: Run focused regression checks**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm exec vitest run tests/integration/agency-verification-workflow.test.ts tests/integration/agency-verification-storage.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add src/app/admin/verifications src/features/agencies/verification/admin-verification-queue.tsx src/features/agencies/verification/admin-verification-review.tsx tests/e2e/admin-verification.spec.ts
git commit -m "feat: add agency verification review console"
```

---

### Task 5: Full Verification Journey and Regression Gate

**Files:**
- Modify: `tests/e2e/agency-onboarding.spec.ts` only if needed to assert the existing redirect into the new verification route.
- Modify: verification tests from Tasks 1–4 only to close failures discovered by the full journey; do not add unrelated features.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a verified complete journey and a clean branch ready for review.

- [ ] **Step 1: Add/extend the cross-screen journey test**

Ensure one Playwright scenario covers the real sequence:

`register/sign in -> create agency -> redirected to /agency/{id}/verification -> upload three required documents -> submit -> verifier starts review -> verifier approves -> agency user sees Verified`.

The test must verify the existing onboarding redirect rather than bypassing onboarding for this single journey.

- [ ] **Step 2: Run the cross-screen journey and verify it passes**

Run:

```bash
pnpm exec playwright test tests/e2e/agency-onboarding.spec.ts tests/e2e/agency-verification.spec.ts tests/e2e/admin-verification.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run the complete repository verification suite**

Run in this order:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

Expected: every command exits 0.

- [ ] **Step 4: Inspect the final diff for trust-boundary regressions**

Confirm from the diff that:

- there is no public storage URL generation for verification evidence;
- no service-role key appears in client code;
- no anonymous policy exposes submissions/documents;
- agency verification decisions still require the database RPC role check;
- public agency visibility remains limited to `agencies.status = 'verified'` plus existing member/admin exceptions;
- DOT accreditation remains optional and visually distinct from GiyaHero verification.

- [ ] **Step 5: Commit final test/regression adjustments**

If Step 1 or regression fixes changed files:

```bash
git add tests src supabase
git commit -m "test: verify agency verification journey"
```

If no files changed, do not create an empty commit.

- [ ] **Step 6: Prepare branch for whole-feature review**

Record the final commit SHA and compare `feat/foundation-delivery` against its implementation starting point so the reviewer can inspect only Agency Verification changes.
