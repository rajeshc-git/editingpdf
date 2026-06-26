# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY tsconfig.json ./

# Copy package files
COPY packages/types/package.json ./packages/types/
COPY packages/editor-core/package.json ./packages/editor-core/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

# Install dependencies (pnpm store is cached across builds via BuildKit)
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# Builder stage
FROM node:20-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/editor-core/node_modules ./packages/editor-core/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Public URLs are baked into the Next.js client bundle at build time.
# Default to relative paths that the Caddy reverse proxy routes to the
# api-gateway (/api) and pdf-engine (/pdf) services.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_PDF_ENGINE_URL=/pdf
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PDF_ENGINE_URL=$NEXT_PUBLIC_PDF_ENGINE_URL

# Build shared packages first
RUN pnpm --filter @open-pdf/types build
RUN pnpm --filter @open-pdf/editor-core build  
RUN pnpm --filter @open-pdf/ui build

# Build web app
RUN pnpm --filter @open-pdf/web build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
