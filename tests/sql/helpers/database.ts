import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

export async function createDatabase(through = "999999") {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create function auth.jwt() returns jsonb language sql stable as
      'select coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb';
    grant usage on schema auth, public, storage to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, owner_id text, metadata jsonb, unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create function storage.foldername(text) returns text[] language sql immutable as
      'select (string_to_array($1, ''/''))[1:array_length(string_to_array($1, ''/''),1)-1]';
  `);
  for (const file of (await readdir(resolve("supabase/migrations"))).sort()) {
    if (file <= through)
      await db.exec(
        await readFile(resolve("supabase/migrations", file), "utf8"),
      );
  }
  return db;
}

export async function asActor<T>(
  db: PGlite,
  actor: string | null,
  run: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor ?? "",
    ]);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: actor, aal: "aal2" }),
    ]);
    await tx.exec(
      actor ? "set local role authenticated" : "set local role anon",
    );
    return run(tx);
  });
}
export const owner = "10000000-0000-4000-8000-000000000001";
export const traveler = "10000000-0000-4000-8000-000000000002";
export const outsider = "10000000-0000-4000-8000-000000000003";
export const reviewer = "10000000-0000-4000-8000-000000000004";
export async function seedIdentities(db: PGlite) {
  for (const id of [owner, traveler, outsider, reviewer])
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id,
      id + "@example.test",
    ]);
  await db.query(
    "insert into public.platform_admin_memberships(user_id,role) values($1,'content_admin')",
    [reviewer],
  );
}
export const agencyId = "20000000-0000-4000-8000-000000000001";
export const packageId = "30000000-0000-4000-8000-000000000001";
export const destinationId = "40000000-0000-4000-8000-000000000001";
export async function seedCatalog(db: PGlite) {
  await seedIdentities(db);
  await db.query(
    "insert into public.agencies(id,name,slug,status,created_by) values($1,'Real Agency','real-agency','verified',$2)",
    [agencyId, owner],
  );
  await db.query(
    "insert into public.agency_members(agency_id,user_id,role) values($1,$2,'owner')",
    [agencyId, owner],
  );
  await db.query(
    "insert into public.destinations(id,province_id,slug,name) select $1,id,'island','Island' from public.provinces limit 1",
    [destinationId],
  );
  await db.query(
    `insert into public.packages(id,agency_id,slug,title,overview,trip_type,duration_days,min_travelers,max_travelers,pricing_model,schedule_model,publication_status,created_by)
    values($1,$2,'island-trip','Real Island Trip','A real trip with itinerary and guide.','island',2,1,8,'per_person','fixed_departures','published',$3)`,
    [packageId, agencyId, owner],
  );
  await db.query(
    "insert into public.package_destinations(package_id,destination_id) values($1,$2)",
    [packageId, destinationId],
  );
  await db.query(
    "insert into public.package_prices(id,package_id,label,amount_minor) values('50000000-0000-4000-8000-000000000001',$1,'Standard',125050)",
    [packageId],
  );
  await db.query(
    `insert into public.package_departures(id,package_id,starts_at,ends_at,booking_cutoff_at,capacity)
    values('60000000-0000-4000-8000-000000000001',$1,now()+interval '30 days',now()+interval '31 days',now()+interval '29 days',3)`,
    [packageId],
  );
  await db.query(
    "insert into public.package_itinerary_days(package_id,day_number,title,description) values($1,1,'Arrival','Meet the guide'),($1,2,'Return','Return home')",
    [packageId],
  );
  await db.query(
    "insert into public.package_features(package_id,feature_type,description) values($1,'inclusion','Local guide'),($1,'exclusion','Personal expenses')",
    [packageId],
  );
  await db.query(
    "insert into public.package_policies(package_id,cancellation_terms,rescheduling_terms,no_show_terms,agency_cancellation_terms) values($1,'Agency cancellation terms apply','Contact the agency to reschedule','No refund for a no show','Agency will arrange a refund')",
    [packageId],
  );
}
