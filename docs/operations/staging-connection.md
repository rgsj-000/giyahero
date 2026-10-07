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

1. Deploy the shared hosted app to an HTTPS testing origin and configure the exact website/mobile authentication redirects in Supabase. The mobile origin/callback and generated native identifiers currently remain scaffolding values; the installed app is not release-ready.
2. Configure the required server-only credentials through a secure local/hosting environment, and supply the isolated database connection for real integration/concurrency tests. Do not send credentials through chat or put them in `VITE_` variables.
3. Onboard a real testing agency and establish an independent verifier/content reviewer using actual authenticated user IDs. Complete agency verification, prepare a package and approve its first publication before travelers see it.
4. Set final testing app identifiers and signing identities, generate matching link association files, and build/test Android and iPhone artifacts as described in [mobile-release.md](mobile-release.md).

This connection check does not establish real sign-in flows, agency approval end to end, simultaneous booking acceptance, hosted media upload behavior, native compilation or device installation. Existing automated/mock evidence and release gates are recorded in [mobile-handoff.md](mobile-handoff.md).
