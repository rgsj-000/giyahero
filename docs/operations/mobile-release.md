# GiyaHero mobile staging and release

The repository contains a shared marketplace, a bundled Capacitor mobile app, and generated Android/iOS projects. Booking requests start **Pending agency approval** and become **Confirmed** only after agency acceptance. Confirmation does not record a payment. Payment is arranged directly with the agency.

The current source uses example staging identifiers for scaffolding. No staging service, HTTPS domain, release signing identity, APK, simulator build, TestFlight installation, or store publication has been verified in this workspace. Do not distribute a bundle configured with example endpoints.

## 1. Create staging

1. Create a separate staging Supabase project in your own account. Keep production data out of staging.
2. Register an HTTPS staging domain and point it at the hosted Next.js app. Keep the mobile callback and association files publicly reachable, including when preview deployment protection is enabled.
3. Copy root `.env.example` to root `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and the public publishable/anon key. Set server-only `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL`. Use the dashboard connection details for the database. Configure these server values in your hosting environment as well.
4. Copy `mobile/.env.example` to `mobile/.env.local`. Replace every placeholder. The mobile app uses only public Supabase configuration; never put a service-role key, database password, signing password, or private certificate in a `VITE_` variable.
5. Reserve your real reverse-domain identifier. Use a separate identifier ending in `.staging` for staging, and a separate Supabase project/domain/identifier for production. The generated `com.example.giyahero.staging` is an example to replace.

Install Node 22 or newer and the pinned pnpm version, then run from the repository root:

```powershell
rtk proxy corepack pnpm install --frozen-lockfile
```

Link the CLI to the **staging** project, verify the project reference, and apply migrations. The following pushes migrations; it does not reset the remote database:

```powershell
rtk proxy supabase login
rtk proxy supabase link --project-ref YOUR_STAGING_PROJECT_REF
rtk proxy supabase db push --linked
```

Use the existing agency onboarding and verification screens to create a staging agency. Create a separate reviewer account. A database administrator can grant that account `agency_verifier` for verification and `content_admin` for first publication review in `public.platform_admin_memberships`. Use actual authenticated user UUIDs, never invent a user UUID. Follow the existing verification/MFA requirements. Do not make the reviewer a member of the agency being reviewed.

Before creating a package, provision the approved destinations through the staging project's SQL editor as a database administrator. Migrations create the Quezon province reference but no destinations. Agencies can select active destinations; they cannot create them. Replace the two destination placeholders below with the actual name and a lowercase hyphenated slug for a destination your agency serves. This statement can be rerun safely and does not create a package or agency:

```sql
insert into public.destinations (province_id, slug, name, is_active)
select id, 'replace-with-real-destination-slug', 'Replace with actual destination name', true
from public.provinces
where code = 'PH-QUE'
on conflict (slug) do update
set name = excluded.name, is_active = true
where destinations.province_id = excluded.province_id
returning id, name, province_id;
```

Confirm that the statement returns one destination, then confirm it appears in the agency editor. Add each approved destination this way. For destinations outside Quezon, first provision the corresponding geographic references and use their actual province code. Keep database administrator credentials on the server or in the dashboard.

At `/agency/onboarding`, register the agency; complete its verification workflow and independent review at `/admin/verifications`. Then create a complete package in the agency workspace, select a provisioned destination, and submit it for first publication review. Approve it at `/admin/packages`. Only published packages from verified agencies appear publicly. There is no sample-inventory fallback.

## 2. Configure sign-in links

In Supabase Authentication, set the hosted staging Site URL and add exact allowed redirect URLs for:

- The existing website callback: `https://YOUR_STAGING_DOMAIN/auth/callback`.
- The mobile callback: `https://YOUR_STAGING_DOMAIN/mobile/auth/callback`.

Enable email/password authentication. Configure Google OAuth in Supabase and Google Cloud using Supabase's provider callback URL. Mobile Google login opens a system browser and manually exchanges the PKCE code in the app. Email confirmation opened on another device may require ordinary password login because the original device holds the PKCE verifier. See [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

Set the Apple team ID and the SHA-256 fingerprint of the certificate signing the installed Android build. A debug APK, a locally signed release, and a Play-distributed build can use different signing certificates. Use the matching certificate; comma-separated fingerprints support key rotation. Google Play app signing may use a different certificate from your upload key.

```powershell
rtk proxy corepack pnpm mobile:release-check
rtk proxy corepack pnpm mobile:configure
rtk proxy corepack pnpm mobile:associations
```

The generator writes `public/.well-known/assetlinks.json` and `public/.well-known/apple-app-site-association` from supplied identities. No real association files are supplied in this source because the domain and signing identities are not available yet. Deploy the generated files to the configured HTTPS domain. Both endpoints must return 200 and JSON content types, without redirects, login protection, or HTML fallbacks. Check the JSON identifiers and fingerprints against the installed build.

The native configuration script updates Android identifiers, the exact callback intent filter, iOS bundle identifier, and associated-domain entitlements. It is safe to rerun when changing staging configuration. See [Android app links](https://developer.android.com/training/app-links/add-applinks) and [Apple associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

Native sessions use the [secure-storage plugin](https://github.com/aparajita/capacitor-secure-storage) through an adapter with iCloud synchronization disabled. Storage errors stop startup rather than switching to unencrypted storage. Browser previews require the explicit `VITE_BROWSER_PREVIEW=true` setting and use browser storage. Set it to `false` for installed builds. The website retains its existing cookie-based session; opening hosted agency verification/admin pages may require separate web sign-in.

## 3. Build and sync

```powershell
rtk proxy corepack pnpm mobile:typecheck
rtk proxy corepack pnpm mobile:build
rtk proxy corepack pnpm mobile:sync
```

The mobile `dist` directory contains local assets packaged into the app. Capacitor has no remote production `server.url`. Rebuild and sync after changing any public environment value or shared screen. Public values are embedded at build time; changing a server environment variable does not update an already installed app.

Icons and splash images were derived from the existing GiyaHero logo. For future artwork changes:

```powershell
rtk proxy corepack pnpm mobile:assets
```

Use [Capacitor environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup). This generated version uses Android API 36 and Java 21. Android Studio/SDK are required for Android compilation; iOS compilation needs macOS and Xcode 26 or newer.

On Windows, open Android Studio with `mobile:android`, or run from `mobile/android` after configuring the SDK:

```powershell
rtk proxy cmd /c gradlew.bat assembleDebug
```

The debug APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a test Android device, then verify the configured domain association. Debug builds do not prove release-signature association.

On macOS, run from `mobile/ios/App`:

```sh
rtk proxy xcodebuild -project App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

The unsigned simulator application is `build/Build/Products/Debug-iphonesimulator/App.app`. It is not an iPhone installation or a TestFlight build.

## 4. CI and signed staging artifacts

`.github/workflows/mobile.yml` checks the mobile bundle and browser flows, builds a debug APK on Linux, and builds an unsigned simulator app on macOS. These jobs are prepared but have not been executed remotely in this session. Default example public values allow compilation only; real service testing needs staging configuration.

Set repository variables:

| Variable                  | Value                                  |
| ------------------------- | -------------------------------------- |
| STAGING_SUPABASE_URL      | Staging project HTTPS URL              |
| STAGING_SUPABASE_ANON_KEY | Public publishable/anon key            |
| STAGING_WEB_ORIGIN        | Hosted staging HTTPS origin            |
| STAGING_AUTH_CALLBACK_URL | Exact mobile callback                  |
| STAGING_APP_ID            | Reserved identifier ending in .staging |

Create a protected GitHub environment named `mobile-staging` with reviewer approval for signing jobs. Set environment variables `APPLE_TEAM_ID` and `ANDROID_SHA256`.

Store Android signing credentials as environment secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Store Apple secrets `APPLE_DISTRIBUTION_P12_BASE64`, `APPLE_DISTRIBUTION_P12_PASSWORD`, `APPLE_STAGING_PROFILE_BASE64`, and `CI_KEYCHAIN_PASSWORD`. The Apple provisioning profile must match the staging bundle ID and include associated domains.

Only a manual workflow dispatch with `build_signed=true` runs signed staging builds. It produces an Android AAB and an App Store Connect-exported staging IPA. It does **not** upload to Play, TestFlight, or the App Store. Supply valid credentials and run the workflow before claiming these artifacts exist.

For TestFlight, create the staging app entry in App Store Connect, upload the reviewed IPA using Xcode Organizer or Transporter, complete processing/compliance questions, add authorized testers, and install through TestFlight on an actual iPhone. TestFlight availability is separate from App Store review and publication.

For production, use a separate controlled environment and final identities, regenerate associations for the actual signing certificates, increment native version/build numbers, verify all gates below, and obtain release authorization before distribution.

## 5. Verification gates

Run unit/SQL tests and the separate mocked HTTP browser suites locally:

```powershell
rtk proxy corepack pnpm test
rtk proxy corepack pnpm test:sql
rtk proxy corepack pnpm test:marketplace
rtk proxy corepack pnpm test:mobile
```

The SQL suite executes migrations and role policies on PGlite PostgreSQL. It does not reproduce independent concurrent database connections or Supabase Storage services. The browser suites use explicit synthetic HTTP responses and test-only sessions; they do not prove staging sign-in or device Keychain/Keystore behavior.

With a Docker-backed local Supabase stack, or a disposable staging test environment, export the root server/test environment values and run `pnpm test:integration` and `pnpm test:e2e`. The real integration suite includes independent HTTP clients racing to accept the last seats, simultaneous idempotent submissions, publication review, and capacity release. It provisions synthetic users/listings and cleans up only its own fixture IDs using privileged test credentials. Run it only against an isolated test environment. Existing agency verification/storage tests remain in the real suites.

Before release, perform this end-to-end sequence with the actual staging service and record build numbers, device/OS versions, results, and request UUIDs:

1. Agency owner creates a full package, receives reviewer feedback, revises and resubmits it; an independent reviewer approves it. Publish and unpublish a later valid revision.
2. Traveler discovers the published listing, signs in, selects a rate, party and dates, submits, restarts/re-signs in, and sees the persisted pending request.
3. Agency booking staff accepts it; the traveler sees Confirmed with original amount and terms. Decline another request with a reason, cancel a pending request as traveler, and cancel a confirmed request as agency with a reason.
4. Edit prices/policies after submission and confirm the request retains the original snapshot. Race two independent staff sessions for the last seats: only one acceptance succeeds. Pending requests consume no seats; cancellation releases seats.
5. Block a request and acceptance after unpublishing/suspending the agency, while preserving decline/cancellation and historical access.
6. Drop the response after server commit, retry with the same submission key, and confirm one request exists. Check My Trips before choosing to start a new request.
7. Check outsider/content/read-only roles cannot read traveler contacts or perform booking decisions.

On **both** Android and a real iPhone, also check:

- Cold launch and foreground callback for email confirmation and Google login; reject unrelated/modified links; opening confirmation on another device offers password login.
- Session restore after process termination and sign-out removing persisted sessions.
- Android back navigation, iPhone navigation, keyboard visibility, safe areas, rotation, and usable touch targets.
- Agency gallery upload, file-size/type rejection, required alt text, unpublished image privacy, and image visibility after review.
- Lost connectivity, retry behavior, app restart after a booking decision, and server status matching displayed status.

## Evidence in this workspace

| Output/check                                           | Status                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| Shared marketplace and booking SQL migrations          | Implemented; local SQL/unit checks pass             |
| Android/iOS source projects and branded assets         | Generated                                           |
| Mobile bundle/typecheck and native sync                | Passed with explicit test-only public settings      |
| Desktop/phone web and mobile browser flows             | Passed using synthetic HTTP fixtures                |
| Real staging Supabase, domain and link association     | Not configured                                      |
| Real PostgreSQL concurrent-connection test             | Prepared; requires local Supabase/Docker or staging |
| Android Gradle APK build and device installation       | Not run; SDK absent                                 |
| iOS simulator compilation                              | Not run; macOS/Xcode absent                         |
| Signed AAB/IPA, TestFlight installation, store release | Not run; signing identities/accounts absent         |

This is a prepared source package, not a claim that a signed or installed mobile release has passed validation.
