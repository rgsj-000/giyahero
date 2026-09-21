import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { parseEnv } from '@/infrastructure/config/env';

const env = parseEnv(process.env);
const sql = postgres(env.DATABASE_URL, { max: 1 });

afterAll(async () => {
  await sql.end();
});

describe('database bootstrap', () => {
  it('has the bootstrap table after migrations run', async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name = 'app_health'
    `;

    expect(rows).toHaveLength(1);
  });
});
