import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? './data/app.db',
  },
});
