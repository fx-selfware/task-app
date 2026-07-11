import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

// Port of frontend/vite.config.ts __APP_COMMIT__: short hash shown in the
// sidebar footer ("build abc1234"). COMMIT_SHA env wins (Docker builds without
// .git), then git, then 'dev'.
function getCommitHash(): string {
  if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
  env: {
    NEXT_PUBLIC_APP_COMMIT: getCommitHash(),
  },
};

export default nextConfig;
