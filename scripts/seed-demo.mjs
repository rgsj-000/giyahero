import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { assertDemoTarget } from "./demo/target.mjs";

// Explicit opt-in, and a pinned target: this command cannot seed production.
const projectRef =
  process.env.DEMO_SUPABASE_PROJECT_REF ?? "psdrzqbqsvpkjscwirog";
assertDemoTarget(projectRef);
const args = process.argv.slice(2);
if (args.some((arg) => !["--apply", "--verify"].includes(arg)))
  throw new Error("Usage: node scripts/seed-demo.mjs [--apply | --verify]");
if (args.includes("--apply") && args.includes("--verify"))
  throw new Error("Choose --apply or --verify.");
const root = fileURLToPath(new URL("..", import.meta.url));
const privateDir = resolve(root, ".demo-seed");
const credentialsFile = resolve(privateDir, "accounts.json");
const cli = process.env.SUPABASE_CLI ?? "supabase";
const cliJson = (...command) => {
  try {
    return JSON.parse(
      execFileSync(cli, [...command, "-o", "json"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      }),
    );
  } catch (error) {
    // Never echo CLI buffers: key retrieval output can contain secrets.
    throw new Error(
      `Supabase CLI ${command[0]} ${command[1]} failed (exit ${error.status ?? "unknown"}). Check CLI login and SUPABASE_CLI.`,
    );
  }
};
const query = (sql) =>
  cliJson("db", "query", "--linked", "--project-ref", projectRef, sql).rows;
const accountSpecs = [
  ["traveler", "Traveler"],
  ["owner", "Agency owner"],
  ["manager", "Agency manager"],
  ["booking-staff", "Agency booking staff"],
  ["content-staff", "Agency content staff"],
  ["read-only", "Agency read only"],
  ["super-admin", "Platform super admin"],
  ["agency-verifier", "Platform agency verifier"],
  ["moderator", "Platform moderator"],
  ["support", "Platform support"],
  ["finance", "Platform finance"],
  ["content-admin", "Platform content admin"],
  ["island-owner", "Island Days owner"],
  ["heritage-owner", "Heritage & Table owner"],
  ["pending-owner", "New Horizons owner"],
];
const countsSql = `with demo_packages as (
  select distinct package_id from public.package_publication_events where note like 'giyahero-demo-v1:package:%'
  union select id from public.packages where slug like 'demo-%'
) select
  (select count(*) from auth.users where email like '%@demo.giyahero.test') users,
  (select count(*) from public.agencies where slug like 'demo-%') agencies,
  (select count(*) from public.packages where id in (select package_id from demo_packages) and publication_status='published') published_tours,
  (select count(*) from public.packages where id in (select package_id from demo_packages) and publication_status='pending_first_review') pending_tours,
  (select count(*) from public.booking_requests r join auth.users u on u.id=r.traveler_id where u.email='traveler@demo.giyahero.test') bookings`;
console.log("GHDB testing project:", projectRef);
console.log("Current demo data:", query(countsSql)[0]);
if (!args.length) {
  console.log(
    "Plan: 15 confirmed accounts covering all 12 roles; 3 verified demo agencies and 1 pending agency; 12 published tours, 2 awaiting review, 1 draft; 4 booking states; existing app images in private Storage.",
  );
  console.log(
    "Run with --apply to provision, or --verify to check the existing seed. Credentials are saved only in the ignored .demo-seed folder.",
  );
  process.exit(0);
}
const keysResult = cliJson("projects", "api-keys", "--project-ref", projectRef);
const keys = Array.isArray(keysResult) ? keysResult : keysResult.keys;
const serviceKey = keys?.find((key) => key.name === "service_role")?.api_key;
const publicKey = keys?.find((key) => key.name === "anon")?.api_key;
if (!serviceKey || !publicKey)
  throw new Error(
    "The CLI did not return the required legacy Auth API keys. No credentials were printed.",
  );
const url = `https://${projectRef}.supabase.co`;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let credentials;
try {
  credentials = JSON.parse(await readFile(credentialsFile, "utf8"));
  if (credentials.projectRef !== projectRef)
    throw new Error("The private login file belongs to another project.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (!args.includes("--apply"))
    throw new Error(
      "Missing .demo-seed/accounts.json. Restore the private login file to verify credentials.",
    );
  if (
    Number(
      query(
        "select count(*) total from auth.users where email like '%@demo.giyahero.test'",
      )[0].total,
    ) > 0
  ) {
    throw new Error(
      "Demo accounts already exist. Restore .demo-seed/accounts.json; the seed will not generate replacement passwords.",
    );
  }
  credentials = {
    projectRef,
    accounts: accountSpecs.map(([name, role]) => ({
      name,
      role,
      email: `${name}@demo.giyahero.test`,
      password: `Gh!${randomBytes(18).toString("base64url")}9a`,
    })),
  };
  await mkdir(privateDir, { recursive: true });
}
const saveCredentials = async () => {
  await writeFile(
    `${credentialsFile}.tmp`,
    JSON.stringify(credentials, null, 2) + "\n",
    { mode: 0o600 },
  );
  await rename(`${credentialsFile}.tmp`, credentialsFile);
};
if (args.includes("--apply")) {
  // Save generated passwords before any external mutation, so retries are safe.
  await saveCredentials();
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`Cannot list demo users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  for (const account of credentials.accounts) {
    const existing = users.find((user) => user.email === account.email);
    if (existing && existing.app_metadata?.demo_seed !== "giyahero-demo-v1")
      throw new Error(
        `Refusing to modify a non-demo account: ${account.email}`,
      );
    if (existing) {
      account.id = existing.id;
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      app_metadata: { demo_seed: "giyahero-demo-v1" },
      user_metadata: {
        full_name:
          account.name === "traveler"
            ? "Alex Demo Traveler"
            : `${account.role} (Demo)`,
      },
    });
    if (error)
      throw new Error(`Cannot create ${account.email}: ${error.message}`);
    account.id = data.user.id;
    await saveCredentials();
    console.log("Created", account.email);
  }
  await saveCredentials();
  cliJson(
    "db",
    "query",
    "--linked",
    "--project-ref",
    projectRef,
    "--file",
    resolve(root, "supabase/seed/010_demo_catalog.sql"),
  );
  const images =
    query(`select m.storage_path,substr(e.note,26) seed_slug from public.package_media m
    join public.package_publication_events e on e.package_id=m.package_id
    where e.note like 'giyahero-demo-v1:package:%'`);
  const files = {
    "pagbilao-cove": "beach.webp",
    "mauban-coast": "mauban.webp",
    "atimonan-trails": "river.webp",
    "pagbilao-family": "bay.webp",
    "cagbalete-getaway": "beach.webp",
    "jomalig-golden": "bay.webp",
    "burdeos-hopping": "beach.webp",
    "cagbalete-private": "mauban.webp",
    "lucban-food": "lucban.webp",
    "tayabas-history": "tayabas.webp",
    "lucena-tastes": "lucban.webp",
    "tiaong-countryside": "river.webp",
    "mauban-review": "mauban.webp",
    "tayabas-review": "tayabas.webp",
    "forest-draft": "river.webp",
  };
  for (const image of images) {
    const filename = files[image.seed_slug];
    if (!filename) continue;
    const { error } = await admin.storage
      .from("package-media")
      .upload(
        image.storage_path,
        await readFile(resolve(root, "public/images", filename)),
        { contentType: "image/webp", upsert: false },
      );
    if (
      error &&
      !["409", "Duplicate"].includes(String(error.statusCode)) &&
      !/already exists|duplicate/i.test(error.message)
    )
      throw new Error(`Cannot upload demo image: ${error.message}`);
  }
  const agencies = query(
    "select id,name,slug from public.agencies where slug like 'demo-%' order by slug",
  );
  const guide = [
    "# GiyaHero private demo logins",
    "",
    "Testing website: https://giyahero-staging-rnj007s-projects.vercel.app",
    "",
    "GHDB only. Synthetic accounts and listings; no real booking or payment. Keep this file private.",
    "",
    "| Role | Email | Password |",
    "| --- | --- | --- |",
    ...credentials.accounts.map(
      (account) =>
        `| ${account.role} | ${account.email} | ${account.password} |`,
    ),
    "",
    "All emails are confirmed. Sign in directly with the email and password above; the .test inboxes do not receive mail.",
    "",
    "## Demo routes",
    "",
    "- Traveler: home page → view a tour → request booking → My Trips. Four seeded trips show pending, accepted, declined and cancelled states.",
    "- Content admin or super admin: /admin/packages (two packages initially awaiting review).",
    "- Agency verifier or super admin: /admin/verifications (New Horizons initially awaiting review; synthetic submission has no legal evidence attached).",
    ...agencies.flatMap((agency) => [
      `- ${agency.name}: /agency/${agency.id}/packages`,
      `- ${agency.name}: /agency/${agency.id}/requests`,
      `- ${agency.name}: /agency/${agency.id}/verification`,
    ]),
    "",
    "Owner, manager, booking staff, content staff and read only accounts belong to Quezon Trails. Other owners belong to their named agency. Admin accounts have only their named platform role and no agency memberships.",
    "",
    "Moderator, support and finance roles exist in the schema but do not yet have dedicated app screens. Booking staff can manage requests; content staff can edit packages; read only users have limited views. Existing permissions apply.",
    "",
    "Images are illustrative existing app assets. Fixed departures and open date windows are calculated relative to the first seed run. Reruns preserve existing demo edits, review decisions and booking history; they do not reset dates or passwords.",
    "",
    "Run `node scripts/seed-demo.mjs --verify` to recheck sign-in and the public catalog. See docs/operations/demo-data.md for CLI setup.",
    "",
  ];
  await writeFile(resolve(privateDir, "LOGIN-GUIDE.md"), guide.join("\n"), {
    mode: 0o600,
  });
}

// Verify with genuine Auth sessions and anonymous catalog/Storage reads.
for (const account of credentials.accounts) {
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || data.user?.id !== account.id)
    throw new Error(
      `Sign-in verification failed for ${account.email}: ${error?.message ?? "user mismatch"}`,
    );
  if (account.name === "traveler") {
    const { data: trips, error: tripError } = await client
      .from("booking_requests")
      .select("id,status");
    if (tripError || trips.length < 4)
      throw new Error("Traveler cannot read the four seeded trips.");
  }
  if (
    [
      "super-admin",
      "content-admin",
      "agency-verifier",
      "moderator",
      "support",
      "finance",
    ].includes(account.name)
  ) {
    const { data: roles, error: roleError } = await client
      .from("platform_admin_memberships")
      .select("role");
    if (
      roleError ||
      roles.length !== 1 ||
      roles[0].role !== account.name.replaceAll("-", "_")
    )
      throw new Error(`Role verification failed for ${account.email}`);
  } else if (account.name !== "traveler") {
    const { data: memberships, error: memberError } = await client
      .from("agency_members")
      .select("role")
      .eq("user_id", account.id);
    const expectedRole = account.name.endsWith("owner")
      ? "owner"
      : account.name.replaceAll("-", "_");
    if (
      memberError ||
      memberships.length !== 1 ||
      memberships[0].role !== expectedRole
    )
      throw new Error(
        `Agency membership verification failed for ${account.email}`,
      );
  }
  await client.auth.signOut();
}
const guest = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const seededIds = new Set(
  query(
    "select distinct package_id from public.package_publication_events where note like 'giyahero-demo-v1:package:%'",
  ).map((row) => row.package_id),
);
const demoTours = [];
let cursor;
do {
  const { data: catalog, error: catalogError } = await guest.rpc(
    "search_published_packages",
    { filters: { limit: 50, ...(cursor ? { cursor } : {}) } },
  );
  if (catalogError)
    throw new Error(`Guest catalog failed: ${catalogError.message}`);
  demoTours.push(...catalog.items.filter((item) => seededIds.has(item.id)));
  cursor = catalog.nextCursor;
} while (cursor);
if (demoTours.length < 12)
  throw new Error(
    `Expected at least 12 published demo tours, received ${demoTours.length}. If demo reviewers unpublished a tour, this is an intentional state change.`,
  );
for (const item of demoTours) {
  const { data: detail, error: detailError } = await guest.rpc(
    "get_public_package_detail",
    { target_package_id: item.id },
  );
  if (detailError || !detail?.rates?.length || !detail?.itinerary?.length)
    throw new Error(`Tour detail is incomplete: ${item.slug}`);
  const { data: signed, error: imageError } = await guest.storage
    .from("package-media")
    .createSignedUrl(item.imagePath, 60);
  if (imageError) throw new Error(`Guest image is unreadable: ${item.slug}`);
  const response = await fetch(signed.signedUrl);
  if (
    !response.ok ||
    !(response.headers.get("content-type") ?? "").startsWith("image/")
  )
    throw new Error(`Image download failed: ${item.slug}`);
}
console.log(
  "Verified all 15 sign-ins and role memberships, traveler trips, public tour details, and image downloads.",
);
console.log("Demo totals:", query(countsSql)[0]);
console.log("Private logins:", resolve(privateDir, "LOGIN-GUIDE.md"));
