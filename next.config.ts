import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

// Short hash shown in the sidebar footer ("build abc1234"). Vercel's injected
// sha wins, then git, then 'dev'.
function getCommitHash(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_COMMIT: getCommitHash(),
  },
};

export default nextConfig;
