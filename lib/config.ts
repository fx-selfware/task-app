import { z } from 'zod';

const envSchema = z.object({
  TURSO_DATABASE_URL: z.string().min(1).default('file:./data/app.db'),
  TURSO_AUTH_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export interface Config {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
  JWT_SECRET: string;
  COOKIE_SECURE: boolean;
}

let cached: Config | null = null;

// Parsed lazily so `next build` succeeds without runtime env vars.
export function getConfig(): Config {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    cached = {
      ...parsed.data,
      // Default to secure cookies whenever we're running on Vercel (always
      // HTTPS there); local http dev sets COOKIE_SECURE=false in .env.
      COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? Boolean(process.env.VERCEL_ENV),
    };
  }
  return cached;
}

// Read dynamically (not from the cached config) so role promotion always
// reflects the current ADMIN_EMAILS value.
export function getAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
