# ==============================================================================
# BOOKED - Multi-stage Docker Build
# ==============================================================================

# ==============================================================================
# Stage 1: Base dependencies
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# ==============================================================================
# Stage 2: Dependencies installer
# ==============================================================================
FROM base AS deps

# Install all dependencies
RUN npm ci

# ==============================================================================
# Stage 3: API Builder
# ==============================================================================
FROM deps AS api-builder

# Copy source code
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN npm run build -w apps/api

# ==============================================================================
# Stage 4: Web Builder
# ==============================================================================
FROM deps AS web-builder

# Copy source code
COPY tsconfig.json ./
COPY apps/web ./apps/web

# Build web app
RUN npm run build -w apps/web

# ==============================================================================
# Stage 5: API Production Image
# ==============================================================================
FROM node:20-alpine AS api

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 booked

# Copy package files
COPY --from=api-builder /app/package*.json ./
COPY --from=api-builder /app/apps/api/package.json ./apps/api/

# Copy node_modules (production only)
COPY --from=deps /app/node_modules ./node_modules

# Copy built API
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
COPY --from=api-builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma

# Set ownership
RUN chown -R booked:nodejs /app

USER booked

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]

# ==============================================================================
# Stage 6: Web Production Image (using serve for static files)
# ==============================================================================
FROM node:20-alpine AS web

WORKDIR /app

# Install curl for health checks and serve for static files
RUN apk add --no-cache curl && \
    npm install -g serve

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 booked

# Copy built web app
COPY --from=web-builder /app/apps/web/dist ./dist

# Set ownership
RUN chown -R booked:nodejs /app

USER booked

EXPOSE 4000

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:4000 || exit 1

CMD ["serve", "-s", "dist", "-l", "4000"]
