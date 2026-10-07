import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { asActor, createDatabase } from "./helpers/database";

it("provisions selectable destinations using the documented fresh-staging SQL", async () => {
  const guide = await readFile("docs/operations/mobile-release.md", "utf8");
  const sql = guide.match(/```sql\s+([\s\S]*?)```/)?.[1];
  expect(
    sql,
    "Staging guide must contain executable destination provisioning SQL",
  ).toBeTruthy();
  const db = await createDatabase();
  try {
    expect(
      (await db.query("select id from public.destinations")).rows,
    ).toHaveLength(0);
    await db.exec(sql!);
    await db.exec(sql!);
    const destinations = await asActor(db, null, (tx) =>
      tx.query("select name from public.destinations where is_active"),
    );
    expect(destinations.rows).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 30000);
