# Mobile implementation handoff

Implementation branch: `feat/mobile-marketplace`. Source workspace: `.worktrees/mobile-marketplace`. Follow [mobile-release.md](mobile-release.md) to provision staging and produce installable builds.

The shared marketplace reads published listings from verified agencies. Travelers submit requests with server-calculated quotes and immutable terms. Requests remain pending until authorized agency staff accept them. Confirmation does not collect payment.

## Review and verification

A fresh read-only reviewer examined the entire implementation. No critical findings were reported. Both important findings were reproduced and fixed:

- Image upload/removal previously replaced unsaved fields with persisted values. The desktop regression reproduced both failures. Image changes now save the current version-checked draft first; desktop and phone checks pass for retained and persisted edits.
- Fresh staging had no selectable destinations. The guide now includes privileged destination provisioning. Its SQL was missing in the failing test, then executed twice on a fresh migrated database and exposed exactly one active destination to the anonymous reader.

Local verification: 79 unit/database tests, 34 desktop/phone marketplace scenarios, and 2 mobile browser scenarios. Typechecks, lint, formatting, production web/mobile builds, and native asset sync are checked separately. Browser tests use synthetic HTTP/session fixtures. PGlite executes migrations and policies but cannot prove simultaneous PostgreSQL connections or hosted Supabase services.

The final marketplace run used two browser workers. A preceding six-worker run hit a hydration timing limit on this workstation; a separate overlapping-suite attempt collided in the shared trace output directory. All 34 assertions passed when run alone with two workers. The final production web build was run with a clean generated cache after browser servers stopped.

No APK, signed AAB, simulator application, IPA, TestFlight installation, or store release was produced locally. No staging backend/domain or signing identity exists in this session. Native CI is prepared but unexecuted. The release validator rejects the current example domain and app ID.

## Rulings I made

These decisions preserve the implementation ledger in chronological order; costs describe what remains to check or change if a decision proves unsuitable.

1. Interpret the approved execution method as inline implementation followed by one fresh review. Cost: the author performs per-task checks.
2. Install dependencies in the isolated worktree using approved network access. Cost: extra workspace disk use and platform dependency setup.
3. Add development-only PGlite because Docker/staging are absent. Cost: live service and concurrent-connection checks remain necessary.
4. Use mocked HTTP browser boundaries with separate PostgreSQL policy tests. Cost: real authentication and Storage remain unverified.
5. Record observed passing task runs instead of repeating them solely for ledger bookkeeping. Cost: task completion records use session evidence; final regressions are run again after changes.
6. Use local UI guidance after the UI CLI stalled and standalone Chrome after the browser plugin failed to initialize. Cost: native/browser-plugin behavior needs separate checking.
7. Preserve hosted publication/verification end-to-end tests as staging gates; use explicit Manila time and currency precision. Cost: hosted authentication needs credentials and future regions may need timezone support.
8. Retain referenced rates/departures as inactive rows. Cost: historical rows accumulate; true multi-client concurrency remains a staging gate.
9. Require the displayed package version on submission. Cost: travelers must refresh changed quotes rather than silently receiving new terms.
10. Share existing hash navigation between hosted and native screens. Cost: future navigation changes must retain back/return behavior.
11. Initialize native secure storage before session reads. Cost: storage failures stop startup and require retry/device diagnosis.
12. Generate scaffolding with explicit example identities, guarded by a release validator. Cost: real identifiers and associations must be supplied before distribution.
13. Resize existing brand artwork using modern Sharp instead of the unsupported asset CLI. Cost: the original small logo limits exported sharpness.
14. Prepare staging instructions and CI in place of unavailable services/artifacts, as requested. Cost: live/device release gates remain outstanding.
15. Model Supabase default grants in SQL fixtures and explicitly revoke catalog writes. Cost: deployed policies must still be checked on Supabase.
16. Preserve Windows line endings and exclude generated Next declarations from formatting/lint checks. Cost: later cross-platform normalization may be needed.
17. Permit compile-only example CI settings; manually signed staging artifacts require real identities. Cost: CI compilation does not validate real links or services.
18. Add review feedback, new-draft reset and user-keyed agency state. Cost: navigating away discards unsaved input.
19. Validate real identity/domain inputs before generating association files. Cost: an unusual legitimate configuration may require validator adjustment.

## Rulings on behaviors the reviewer could not verify

- Real simultaneous PostgreSQL connections and deployed roles remain mandatory staging gates. Cost if bypassed: capacity/idempotency or permission failures could escape local tests.
- Hosted sign-in, Storage and persistence need actual staging service tests. Cost if bypassed: service configuration failures could affect travelers and agencies.
- Native compilation, signing, installation and distribution need the documented tools/accounts. Cost if bypassed: prepared source could fail to compile or install.
- Device secure storage, link delivery/association, keyboard, safe areas, back behavior and image picking need both Android and iPhone checks. Cost if bypassed: device-specific failures remain possible.
- Payment collection and store publication remain outside this approved preparation scope. Cost: agencies arrange payment directly; distribution is a later authorized action.

## Deferred minors

The independent review reported none. Existing lint warnings and the mobile bundle-size advisory are recorded as build observations, not release-validation evidence.
