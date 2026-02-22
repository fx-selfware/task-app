FROM node:20-alpine AS base
WORKDIR /app
ARG PROXY_CA_B64=
ARG PROXY_HOST=
RUN if [ -n "$PROXY_CA_B64" ]; then printf '%s' "$PROXY_CA_B64" | base64 -d > /tmp/proxy-ca.crt; fi
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
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS builder
COPY . .
RUN npm run build

FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
