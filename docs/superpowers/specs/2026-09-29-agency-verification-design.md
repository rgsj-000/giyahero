# Agency Verification Design

Date: 2026-09-29
Branch: `feat/foundation-delivery`
Status: Design approved in chat; written spec awaiting review

## 1. Purpose

Agency Verification gives GiyaHero a controlled way to determine which agency organizations may present themselves as verified and later publish traveler-facing packages.

The feature extends the existing agency foundation. It does not create a second agency model, second membership model, or separate authentication system.

Success means an agency owner or manager can prepare a private verification application, upload the required documents, formally submit the application, and see its review outcome, while an authorized GiyaHero verifier can review the same application and make an auditable approval or rejection decision. Verification decisions must update the agency lifecycle atomically and must not expose private business documents to travelers or unrelated users.

## 2. Existing Foundation Reused

The implementation must build on the structures already present on `feat/foundation-delivery`:

- Supabase authentication and user profiles
- `agencies`
- `agency_members`
- agency roles and `has_agency_role(...)`
- `platform_admin_memberships`
- platform admin roles including `agency_verifier`
- `has_platform_admin_role(...)`
- `agency_verification_submissions`
- `agency_verification_documents`
- the existing agency lifecycle values on `agencies.status`
- the existing `create_agency_with_owner(...)` transactional RPC
- `/agency/onboarding`, which already redirects newly created agencies to `/agency/{agencyId}/verification`
- the current Next.js App Router, Supabase client helpers, CI, unit, integration, and E2E test setup

No duplicate tables should be introduced for concepts already represented above.

## 3. Scope

### Included in Release 1

1. Agency verification draft lifecycle
2. Private verification document upload and removal while a submission is editable
3. Formal submission by an agency owner or manager
4. Agency verification status page
5. Admin verification queue
6. Admin verification review screen
7. Start review, approve, and reject actions
8. Atomic synchronization between verification submission status and agency status
9. Access control through RLS and narrowly scoped RPCs
10. Integration and E2E coverage for the verification workflow

### Not Included in Release 1

- OCR or AI extraction from uploaded documents
- automatic government registry validation
- DOT API integration
- automatic expiration monitoring
- automated reverification scheduling
- payment processing
- package publishing UI itself
- public agency profile redesign
- traveler reviews

Those can be added after the manual verification workflow is stable.

## 4. Product Policy

GiyaHero verification is a platform trust decision. It must not be represented as equivalent to government accreditation.

For the initial pilot, the verification form will support these document categories:

- Business Registration: required
- Current Business Permit: required
- Authorized Representative ID: required
- DOT Accreditation: optional

These are GiyaHero pilot verification requirements, not a statement that every category is legally required for every possible business entity.

If DOT accreditation is supplied and separately validated, the product may later display a distinct DOT-related indicator. The base GiyaHero verified badge must remain conceptually separate from government accreditation.

## 5. Actors and Permissions

### Agency Owner

May:

- open the agency verification workspace
- create or resume an editable draft submission
- upload, replace, and remove draft documents
- formally submit the application
- view previous and current submissions
- view review status and decision notes

### Agency Manager

Has the same Release 1 verification permissions as an owner.

### Other Agency Roles

`booking_staff`, `content_staff`, and `read_only` do not gain verification mutation privileges in Release 1.

### Platform Verifier

A user with `agency_verifier` or `super_admin` may:

- list submitted and under-review applications
- inspect agency information and uploaded documents
- start review
- approve
- reject
- view previous submissions and decision history

Other platform roles do not gain verification decision privileges unless explicitly added later.

### Traveler or Unrelated User

May not access verification submissions, verification documents, private storage objects, decision notes, or internal review metadata.

## 6. Lifecycle

### Agency Status

The existing `agencies.status` remains the public/business lifecycle authority:

`draft -> submitted -> under_review -> verified`

or

`draft -> submitted -> under_review -> rejected`

A verified agency may later become `suspended` through a separate administrative process.

### Verification Submission Status

The existing verification status enum must be expanded to include `draft`:

`draft -> submitted -> under_review -> verified`

or

`draft -> submitted -> under_review -> rejected`

A new verification submission starts as `draft`, not `submitted`.

### Why Draft Is Required

The document rows belong to a verification submission. Agencies therefore need a submission record before they can attach documents, but that record must not be interpreted as a formal application until the agency explicitly submits it.

`submitted_at` must therefore become nullable and is populated only during formal submission.

### State Transition Rules

- Only `draft` submissions are editable by the agency.
- Uploading or removing documents is forbidden after formal submission.
- Only an owner or manager may transition `draft -> submitted`.
- Submission is allowed only when all required document categories are present.
- Submitting sets the parent agency to `submitted` in the same transaction.
- Only a `super_admin` or `agency_verifier` may transition `submitted -> under_review`.
- Starting review sets the parent agency to `under_review` in the same transaction.
- Only `under_review` submissions may be approved or rejected.
- Approval sets the submission to `verified`, sets the agency to `verified`, and records `agencies.verified_at`.
- Rejection sets the submission to `rejected` and sets the agency to `rejected`.
- Rejection requires non-empty decision notes.
- A terminal submission is immutable.

## 7. Data Model Changes

A new migration will modify rather than replace the existing verification schema.

### `agency_verification_status`

Add `draft`.

### `agency_verification_submissions`

Adjust the current structure so that:

- `status` defaults to `draft`
- `submitted_at` is nullable
- `reviewed_by` and `reviewed_at` remain nullable until a final decision
- `decision_notes` remains nullable for approval but is mandatory for rejection through the decision RPC

Recommended consistency checks should guarantee sensible timestamp/state combinations where practical without making future migrations unnecessarily difficult.

### `agency_verification_documents`

Reuse the existing table.

Release 1 will continue to store:

- submission ID
- agency ID
- document type
- storage path
- original filename
- MIME type
- size
- uploader
- upload timestamp

Document review per individual file is not required for Release 1. The verifier makes the decision at application level.

## 8. Storage Design

Create a private Supabase Storage bucket named:

`agency-verification`

Objects use an agency-scoped path:

`agency/{agencyId}/{submissionId}/{documentId}/{sanitizedFilename}`

The database row stores the resulting path.

### Storage Rules

- bucket is private
- agency owners and managers may upload only to their own agency draft submission path
- agency owners and managers may read their own agency verification objects
- agency owners and managers may delete only objects belonging to a draft submission
- `super_admin` and `agency_verifier` may read verification objects for review
- unrelated authenticated users and anonymous users receive no access

Application code must not generate publicly accessible permanent document URLs. Review screens should use authenticated access or short-lived signed URLs where needed.

## 9. Mutation Boundary

Direct broad write policies on the verification tables should be avoided. Mutations should be expressed through security-definer RPCs that validate actor, ownership, role, current state, and transition rules.

### `create_verification_draft(agency_id)`

Responsibilities:

- require authentication
- require agency owner or manager role
- reuse the existing editable draft if one already exists
- otherwise create one new draft submission
- return the submission ID

The RPC must prevent multiple simultaneous editable drafts for the same agency.

### `register_verification_document(...)`

Responsibilities:

- require owner or manager role
- require a draft submission belonging to the agency
- validate the supported document type
- register storage metadata after successful object upload
- prevent a user from registering metadata against another agency or submission

The UI may treat one current file per required category as the normal path. Replacing a document removes the old draft object and metadata before or as part of replacement handling.

### `remove_verification_document(document_id)`

Responsibilities:

- require owner or manager role
- require the parent submission to remain `draft`
- delete the metadata record

Storage object deletion must also be completed by the application workflow. Failure handling must not leave the UI claiming a file is absent while the database still references it.

### `submit_agency_verification(submission_id)`

Responsibilities:

- require owner or manager role for the parent agency
- require submission status `draft`
- confirm all required document categories are represented
- set submission status to `submitted`
- set `submitted_at = now()`
- set agency status to `submitted`
- perform submission and agency state change atomically

### `start_agency_verification_review(submission_id)`

Responsibilities:

- require `super_admin` or `agency_verifier`
- require status `submitted`
- set submission status to `under_review`
- set agency status to `under_review`
- perform both changes atomically

Starting review does not set `reviewed_at`; that timestamp records the final decision.

### `decide_agency_verification(submission_id, decision, notes)`

Responsibilities:

- require `super_admin` or `agency_verifier`
- require submission status `under_review`
- allow only `verified` or `rejected` as the decision
- require trimmed non-empty notes for rejection
- set `reviewed_by = auth.uid()`
- set `reviewed_at = now()`
- set the submission status
- update the agency status in the same transaction
- for approval, set `agencies.verified_at = now()` and clear stale rejection/suspension state as applicable
- for rejection, leave `verified_at` null

## 10. RLS Strategy

Existing read policies for verification submissions and documents are retained conceptually:

- owners/managers may read their agency verification records
- `super_admin`/`agency_verifier` may read records for review

The implementation should add only the minimum additional policies required by the chosen storage/RPC mechanics.

Database table writes should flow through the RPCs rather than permissive client-side insert/update/delete policies.

The application UI is not an authorization boundary. Every sensitive operation must be enforced in PostgreSQL/RLS/RPC logic even when the corresponding button is hidden in the interface.

## 11. Agency Verification Screen

Route:

`/agency/[agencyId]/verification`

The route is authenticated and must confirm the current user has owner or manager access before exposing verification controls.

### Page Structure

1. GiyaHero/agency context header
2. Verification status banner
3. Required documents checklist
4. Upload cards for each supported document category
5. Submission summary
6. Primary action area
7. Previous/decision information when relevant

### Draft Experience

The page shows the required categories and their completion state.

Each document card shows:

- category label
- required or optional indicator
- selected/uploaded filename
- upload timestamp after persistence
- Replace action while draft
- Remove action while draft

The Submit for Verification button remains disabled until all required categories exist.

### Submitted Experience

After submission:

- upload/replace/remove controls disappear or become disabled
- the page shows `Submitted`
- submitted timestamp is shown
- a short message explains that the agency can no longer change the application while it is under review

### Under Review Experience

The page shows `Under review` and remains read-only.

### Verified Experience

The page shows a clear successful verification state and verified date from the agency record.

### Rejected Experience

The page shows:

- rejected status
- decision timestamp
- decision notes

Release 1 does not automatically reopen a rejected submission. A later iteration may add explicit resubmission/reverification behavior. Until then, rejection is a terminal state for that submission and a new submission flow can be introduced as a follow-up feature.

## 12. Admin Verification Queue

Route:

`/admin/verifications`

Access is restricted to `super_admin` and `agency_verifier`.

The queue should prioritize applications that need action.

Each row/card shows:

- agency name
- submitted date
- current submission status
- document completeness/count
- review action

Default queue states are `submitted` and `under_review`.

The screen may offer simple status filtering. Advanced search, pagination, sorting presets, and bulk actions are not required for Release 1.

## 13. Admin Review Screen

Route:

`/admin/verifications/[submissionId]`

The screen shows:

- agency identity/profile information already stored in `agencies`
- submission metadata
- uploaded verification documents
- secure document view/download actions
- current status
- decision history available on the submission

### Actions

For `submitted`:

- Start Review

For `under_review`:

- Verify Agency
- Reject Agency

Reject Agency opens a notes field and requires a reason before confirmation.

Approval should also require an explicit confirmation interaction because it changes public trust status.

## 14. Data Flow

### Agency Submission

1. User completes agency onboarding.
2. Existing onboarding redirects to `/agency/{agencyId}/verification`.
3. Verification page loads or creates a draft submission through the controlled RPC.
4. User uploads a document to the private bucket.
5. After storage succeeds, document metadata is registered against the draft.
6. User repeats until all required categories are present.
7. User selects Submit for Verification.
8. RPC validates completeness and role, transitions the submission to `submitted`, and sets the agency to `submitted` atomically.
9. Page refreshes into read-only submitted state.

### Admin Review

1. Authorized verifier opens `/admin/verifications`.
2. Queue loads submitted/under-review applications.
3. Verifier opens a submission.
4. Documents are accessed through private authenticated/signed access.
5. Verifier starts review.
6. RPC moves submission and agency to `under_review` atomically.
7. Verifier approves or rejects.
8. Decision RPC updates the submission and agency atomically.
9. Agency user subsequently sees the updated state on the verification page.

## 15. Error Handling

### Unauthorized Access

Return/redirect without leaking whether inaccessible agency or submission records exist. The database still enforces access even if route guards fail.

### Incomplete Submission

The client disables submission when incomplete, but the RPC independently rejects incomplete applications.

### Upload Failure

Do not register database metadata for an object that failed to upload.

### Metadata Registration Failure After Storage Upload

Attempt cleanup of the newly uploaded object and surface a recoverable error. The user must not see the category as complete unless the database registration succeeds.

### Storage Deletion Failure

Do not silently remove metadata if storage cleanup cannot be completed through the intended workflow. Surface an error and preserve a consistent visible state.

### Stale UI / Concurrent Transition

RPCs verify current status before every transition. A stale browser cannot re-submit, re-review, or overwrite a completed decision.

### Duplicate Decision

A final decision is accepted only when the submission is currently `under_review`. Repeated approval/rejection attempts fail safely.

## 16. Auditability

Release 1 must preserve enough immutable facts on the verification submission to answer:

- who submitted
- when it was submitted
- who made the final decision
- when the decision was made
- what the final decision was
- why it was rejected, when applicable

If the existing branch gains a general append-only `audit_events` facility before implementation reaches this feature, verification transitions should also emit audit events. The core verification feature must not be blocked on creating an unrelated generalized audit subsystem.

## 17. Public Trust Boundary

Only `agencies.status = 'verified'` may qualify an agency for a GiyaHero verified badge or verified-only traveler discovery behavior.

Private verification documents, internal decision notes, verifier identity, and review metadata are never exposed as part of the public agency object.

Future package publishing logic must check agency verification on the server/database boundary, not merely hide a Publish button in the UI.

## 18. Testing Strategy

The implementation follows the repository's existing unit, Supabase integration, and Playwright E2E test structure.

### Database / Integration Tests

Cover at minimum:

- unauthenticated users cannot create drafts
- unrelated agency members cannot read or mutate another agency's application
- owner can create/resume one draft
- manager can create/resume draft
- non-manager agency roles cannot mutate verification
- required categories are enforced on submission
- draft can be edited
- submitted application cannot be edited
- owner/manager cannot invoke verifier transitions
- non-verifier platform admins cannot make verification decisions
- verifier can start review
- only under-review application can receive a decision
- rejection requires notes
- approval updates both submission and agency atomically
- rejection updates both submission and agency atomically
- private documents cannot be read by anonymous or unrelated authenticated users

### Unit Tests

Cover isolated helpers introduced by the feature, such as:

- supported document type metadata
- completeness calculation used by the UI
- filename/path sanitization helper if implemented in application code
- status presentation mapping

Do not duplicate database authorization rules as client-only unit logic.

### E2E Tests

At minimum, exercise:

1. authenticated agency onboarding redirect into verification
2. draft verification page renders
3. required document completion enables submission
4. submission produces read-only submitted state
5. authorized verifier sees the application in the admin queue
6. verifier starts review and approves or rejects
7. agency sees the resulting final status

Storage-heavy E2E interactions may use the repository's existing local Supabase test environment and small fixture files.

## 19. Acceptance Criteria

Agency Verification Release 1 is complete when all of the following are true:

- a newly onboarded agency lands on a functional verification page
- an owner or manager can create/resume exactly one editable verification draft
- required files are stored privately and metadata is persisted correctly
- a draft cannot be submitted without every required category
- submitted applications become immutable to agency users
- only `super_admin` and `agency_verifier` can review and decide applications
- approval changes both the submission and agency to `verified` atomically
- rejection changes both the submission and agency to `rejected` atomically and records a reason
- unrelated users cannot access application records or verification files
- the admin queue and review screen work for the complete manual review path
- verification does not claim or imply DOT accreditation unless separately represented
- all new database integration, unit, E2E, lint, type, and build checks pass

## 20. Implementation Boundaries

This feature should stay focused on the manual human-reviewed MVP.

Do not add OCR, AI document extraction, external government integrations, package publishing, booking logic, payment logic, or generalized moderation features as part of this implementation.

The intended vertical slice is:

`agency onboarding -> verification draft -> private documents -> submit -> admin review -> decision -> agency verified/rejected state`
