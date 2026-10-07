import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createDatabase,
  seedCatalog,
  asActor,
  owner,
  outsider,
  packageId,
  agencyId,
} from "./helpers/database";
let db: Awaited<ReturnType<typeof createDatabase>>;
const mediaId = "70000000-0000-4000-8000-000000000001";
const path =
  "agency/" + agencyId + "/package/" + packageId + "/" + mediaId + ".png";
beforeAll(async () => {
  db = await createDatabase();
  await seedCatalog(db);
  await db.exec(
    "insert into storage.buckets(id,name,public) values('package-media','package-media',false) on conflict(id) do nothing",
  );
  await db.query(
    'insert into storage.objects(bucket_id,name,owner,owner_id,metadata) values(\'package-media\',$1,$2::uuid,($2::uuid)::text,\'{"size":12,"mimetype":"image/png"}\')',
    [path, owner],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("registers only an editor-owned object in the package's generated path", async () => {
  await expect(
    asActor(db, outsider, (tx) =>
      tx.query("select public.register_package_media($1,$2,$3,'Island view')", [
        packageId,
        mediaId,
        path,
      ]),
    ),
  ).rejects.toThrow("Not authorized");
  await expect(
    asActor(db, owner, (tx) =>
      tx.query("select public.register_package_media($1,$2,$3,'Island view')", [
        packageId,
        mediaId,
        "agency/" + agencyId + "/package/" + outsider + "/" + mediaId + ".png",
      ]),
    ),
  ).rejects.toThrow();
  await asActor(db, owner, (tx) =>
    tx.query("select public.register_package_media($1,$2,$3,'Island view')", [
      packageId,
      mediaId,
      path,
    ]),
  );
  const visible = await asActor(db, null, (tx) =>
    tx.query(
      "select name from storage.objects where bucket_id='package-media'",
    ),
  );
  expect(visible.rows).toHaveLength(1);
  await db.query(
    "update public.packages set publication_status='draft' where id=$1",
    [packageId],
  );
  const hidden = await asActor(db, null, (tx) =>
    tx.query(
      "select name from storage.objects where bucket_id='package-media'",
    ),
  );
  expect(hidden.rows).toEqual([]);
});
