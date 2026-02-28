FROM node:20-slim AS base
WORKDIR /app
ARG PROXY_CA_B64=
ARG PROXY_HOST=
RUN if [ -n "$PROXY_CA_B64" ]; then printf '%s' "$PROXY_CA_B64" | base64 -d > /tmp/proxy-ca.crt; fi
# Install openssl so Prisma detects OpenSSL 3.0.x and downloads the correct engine binaries
RUN if [ -n "$PROXY_HOST" ]; then \
    export http_proxy="http://$PROXY_HOST:3128" https_proxy="http://$PROXY_HOST:3128"; \
  fi \
  && apt-get update -qq \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN if [ -n "$PROXY_HOST" ]; then \
  NODE_EXTRA_CA_CERTS=/tmp/proxy-ca.crt \
  HTTP_PROXY="http://$PROXY_HOST:3128" \
  HTTPS_PROXY="http://$PROXY_HOST:3128" \
  npm ci; \
else \
  npm ci; \
fi

FROM base AS dev
COPY . .
RUN node_modules/.bin/prisma generate
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY . .
RUN node_modules/.bin/prisma generate
RUN npm run build

FROM base AS production
WORKDIR /app
RUN npm prune --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY src/prisma ./src/prisma
ENV NODE_ENV=production
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
