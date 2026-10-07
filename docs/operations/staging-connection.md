# GiyaHero testing Supabase connection

Project: `GHDB` (`psdrzqbqsvpkjscwirog`), confirmed by the owner as a testing project. Public endpoint: `https://psdrzqbqsvpkjscwirog.supabase.co`.

The public publishable key is configured in the isolated workspace's ignored root and mobile `.env.local` files and in GitHub repository variables `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY`. The key value is not committed in this document. Supabase CLI generated connection state is ignored at `supabase/.temp/`.

## Verified setup

- The existing authenticated Supabase CLI can access the healthy project.
- Direct database inspection established an empty public schema and no migration history. A dry run identified all ten repository migrations; all ten were then applied successfully without a database reset.
- The public `search_published_packages` RPC returns HTTP 200 and an empty catalog.
- Row security is enabled on every public table. Anonymous package inserts, authenticated direct package updates and authenticated direct booking inserts are denied; the controlled RPC workflows remain the mutation path.
- Both `package-media` and `agency-verification` buckets are private.
- Quezon, using the province reference already established by migrations, is available as a selectable destination. No synthetic agency or published package was added.
- Email authentication and signup are enabled. Google authentication is not configured.

The initial unauthenticated HEAD checks did not reliably establish table existence; the SQL schema inspection, migration history and subsequent successful public RPC are the evidence for the deployed setup.

## Remaining setup

1. Configure the required server-only credentials through a secure local/hosting environment, and supply the isolated database connection for real integration/concurrency tests. Do not send credentials through chat or put them in `VITE_` variables. The current catalog and public authentication clients use the public key; `/api/health` and any service-role administration require the remaining server configuration.
2. Onboard a real testing agency and establish an independent verifier/content reviewer using actual authenticated user IDs. Complete agency verification, prepare a package and approve its first publication before travelers see it.
3. Set final testing app identifiers and signing identities, generate matching link association files, and build/test Android and iPhone artifacts as described in [mobile-release.md](mobile-release.md). The native identifiers still use `com.example.giyahero.staging`; no APK or IPA has been compiled or installed.

## Hosted staging deployment — 2026-10-07

Canonical testing website: [GiyaHero staging](https://giyahero-staging-rnj007s-projects.vercel.app). Use this address for authentication so the website origin matches the configured callback URLs.

- Dedicated Vercel project: `giyahero-staging` (`prj_W8Oz416CK2YfAq6bxugFm4At2ryC`), in `rnj007s-projects`. Its production target is this testing website and testing database.
- Deployment `dpl_FJsBbTuLCsUdLaBDcK2SjKHZagmn` reached `READY`, using branch `feat/mobile-marketplace` at commit `afaec2354015966f3aaa5b24939e2e902561119f`. Immutable URL: `https://giyahero-staging-l97l1iada-rnj007s-projects.vercel.app`.
- Supabase site URL is the canonical origin. Allowed HTTPS redirects are its `/auth/callback` and `/mobile/auth/callback` paths; localhost web callbacks are also allowed for development. A post-update CLI comparison confirmed zero declared configuration updates. Email confirmations remain enabled; Google authentication remains unconfigured.
- GitHub variables `STAGING_WEB_ORIGIN` and `STAGING_AUTH_CALLBACK_URL`, ignored local mobile environment values, and tracked Android/iOS associated domains now point to that canonical site. Mobile TypeScript/Vite build and Capacitor synchronization succeeded with these values. Signing-specific website association files remain pending.
- Fresh Chrome desktop and Pixel 7 browser contexts, with no mocked requests or sessions, received HTTP 200 from the home page and real catalog RPC. Both displayed the empty catalog and Quezon destination, opened My Trips and its login prompt, rendered signup/login and public agency onboarding forms, redirected guest admin access to login, and opened the mobile callback page. Neither context emitted an unhandled page error. Screenshots were inspected locally.
- The deployment's error/fatal runtime log query returned no matching records in the last 30 minutes. This is limited to the exercised guest pages and is not a complete application audit.

These checks do not establish completed email confirmation/sign-in, agency approval end to end, simultaneous booking acceptance, hosted media upload behavior, native compilation or device installation. Existing automated/mock evidence and release gates are recorded in [mobile-handoff.md](mobile-handoff.md).
