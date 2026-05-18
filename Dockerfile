# ============================================================================
# Multi-stage Dockerfile for Web UI Absensi (Next.js 14)
# ============================================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma clients
RUN npx prisma generate --schema=prisma/schema-master.prisma && \
    npx prisma generate --schema=prisma/schema-tenant.prisma

# Build Next.js
RUN npm run build

# --- Stage 3: Production ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies
COPY --from=deps /prod_node_modules ./node_modules

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Copy Prisma schemas and generated clients
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

# Copy seed scripts
COPY --from=builder /app/prisma/seed-master.ts ./prisma/seed-master.ts
COPY --from=builder /app/prisma/seed-tenant-tjahaja.ts ./prisma/seed-tenant-tjahaja.ts

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create data directories
RUN mkdir -p databases/tenants data backups uploads && \
    chown -R nextjs:nodejs databases data backups uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
