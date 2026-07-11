# Optional single-container build for self-hosters. Not used by dev, tests,
# or the default Vercel deployment — see deploy/README.md.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG COMMIT_SHA=
RUN COMMIT_SHA=${COMMIT_SHA} npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 TURSO_DATABASE_URL=file:/data/app.db
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "server.js"]
