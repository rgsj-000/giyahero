# Demo data for GHDB

The opt-in demo seed targets only the owner-approved GHDB testing project `psdrzqbqsvpkjscwirog`. It adds synthetic data without resetting the database or changing row security. It is separate from production migrations and the automatic local health seed.

Use an authenticated Supabase CLI that supports `db query --linked` (tested with 2.117.0). Set `SUPABASE_CLI` to its executable path if it is not on PATH. Run from the repository:

```powershell
node scripts/seed-demo.mjs           # inspect counts and planned changes
node scripts/seed-demo.mjs --apply   # create missing accounts, catalog and Storage images; verify
node scripts/seed-demo.mjs --verify  # verify existing logins and public catalog
```

The CLI retrieves project API keys into process memory. Service credentials are never logged, saved or placed in client configuration. Each demo user gets a distinct random password and confirmed email under `demo.giyahero.test`. Account ownership is marked in Auth app metadata. The ignored `.demo-seed/accounts.json` preserves IDs/passwords across retries; `.demo-seed/LOGIN-GUIDE.md` lists logins and agency routes. Keep both private and preserve them for reruns. Losing these files requires a separate intentional account recovery; the seed does not reset existing passwords.

The initial dataset contains 15 accounts covering traveler, all five agency roles and all six platform roles, plus owners for the other demo agencies. Three verified agencies offer twelve published Quezon tours spanning islands, beaches, nature, heritage, food and culture. A fourth agency awaits verification. Two additional packages await independent content review, and one is a draft. The traveler has four booking requests: pending, accepted, declined and cancelled, with event history created through the booking functions. Images reuse the existing app assets and are illustrative.

Dates are relative to the initial run. Published packages are created through draft/submission/independent review RPCs; sample booking requests and decisions use the real booking RPCs. Agency verification records are explicitly synthetic fixtures; the pending submission has no real legal evidence. The seed does not send mail, make payments or create real reservations.

Reruns identify packages by immutable seed markers in publication history, so editable package addresses can change without duplicating tours. Booking submission keys preserve requests, review decisions, edits and history; reruns do not refresh old dates. Existing image objects are retained. Verification requires at least twelve visible demo tours; deliberate unpublication can make that check fail. Moderator, support and finance have schema roles but no dedicated screens in the current app.

`tests/sql/demo-seed.test.ts` exercises the seed against all migrations with guest image permissions, editor validation, actual booking workflows and reruns including renamed tours. `tests/unit/demo-seed-target.test.ts` verifies that alternate projects are refused. Hosted application rendering and native installation are separate checks.
