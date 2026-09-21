import { describe, expect, it } from 'vitest';
import { checkHealth } from '@/infrastructure/health/check-health';

describe('health behavior', () => {
  it('reports healthy core services when the database is available and AI is not configured', async () => {
    const result = await checkHealth({
      checkDatabase: async () => undefined,
      aiConfigured: false,
    });

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('ok');
    expect(result.checks.ai).toBe('not_configured');
  });

  it('reports degraded when the database is unavailable', async () => {
    const result = await checkHealth({
      checkDatabase: async () => {
        throw new Error('database unavailable');
      },
      aiConfigured: false,
    });

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('failed');
    expect(result.checks.ai).toBe('not_configured');
  });
});
