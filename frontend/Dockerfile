FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
ARG INTERNAL_API_BASE_URL=http://backend:8000/api/v1
ARG AUTH_COOKIE_SECURE=true
ARG NEXT_PUBLIC_APP_URL
ENV INTERNAL_API_BASE_URL=${INTERNAL_API_BASE_URL} \
    AUTH_COOKIE_SECURE=${AUTH_COOKIE_SECURE} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ARG NEXT_PUBLIC_ENABLE_ADMIN_PORTAL=true
ENV NEXT_PUBLIC_ENABLE_ADMIN_PORTAL=${NEXT_PUBLIC_ENABLE_ADMIN_PORTAL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
