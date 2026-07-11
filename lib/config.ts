import { z } from 'zod';

const envSchema = z.object({
  SQLITE_PATH: z.string().min(1).default('./data/app.db'),
  JWT_SECRET: z.string().min(16),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

// Parsed lazily so `next build` succeeds without runtime env vars.
export function getConfig(): Config {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment variables: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    cached = parsed.data;
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
