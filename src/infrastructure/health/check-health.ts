export type HealthStatus = 'ok' | 'degraded';
export type CheckStatus = 'ok' | 'failed' | 'not_configured';

export type HealthResult = {
  status: HealthStatus;
  checks: {
    application: 'ok';
    database: 'ok' | 'failed';
    ai: 'ok' | 'not_configured';
  };
};

export async function checkHealth(options: {
  checkDatabase: () => Promise<void>;
  aiConfigured: boolean;
}): Promise<HealthResult> {
  try {
    await options.checkDatabase();
    return {
      status: 'ok',
      checks: {
        application: 'ok',
        database: 'ok',
        ai: options.aiConfigured ? 'ok' : 'not_configured',
      },
    };
  } catch {
    return {
      status: 'degraded',
      checks: {
        application: 'ok',
        database: 'failed',
        ai: options.aiConfigured ? 'ok' : 'not_configured',
      },
    };
  }
}
