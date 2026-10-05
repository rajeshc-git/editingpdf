# syntax=docker/dockerfile:1
FROM oven/bun:1.4.2-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy package manifests & lockfile
COPY package.json turbo.json tsconfig.json bun.lock* ./
COPY packages ./packages
COPY apps/web ./apps/web

# Fast install & build using Bun 1.4.2
RUN bun install
RUN cd packages/types && bun run build && \
    cd ../editor-core && bun run build && \
    cd ../ui && bun run build && \
    cd ../../apps/web && bun run build

# Stage 2: Ultra-lightweight runner image (~110MB)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
