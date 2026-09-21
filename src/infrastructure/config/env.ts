import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    SENTRY_DSN: z.string().url().optional(),
    REDIS_REST_URL: z.string().url().optional(),
    REDIS_REST_TOKEN: z.string().min(1).optional(),
    AI_API_KEY: z.string().min(1).optional(),
    EMAIL_API_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY must never be public',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseEnv(input: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(input);
}

export function getEnv(): ServerEnv {
  return parseEnv(process.env);
}
