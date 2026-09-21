import postgres from 'postgres';
import { NextResponse } from 'next/server';
import { getEnv } from '@/infrastructure/config/env';
import { checkHealth } from '@/infrastructure/health/check-health';

export async function GET() {
  const env = getEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 5 });

  const result = await checkHealth({
    aiConfigured: Boolean(env.AI_API_KEY),
    checkDatabase: async () => {
      await sql`select 1`;
    },
  });

  await sql.end({ timeout: 1 });

  return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 503 });
}
