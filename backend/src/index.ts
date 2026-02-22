import { config } from './config';
import { buildApp } from './server';

async function main() {
  const app = await buildApp();
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`🚀 Server listening on port ${config.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
