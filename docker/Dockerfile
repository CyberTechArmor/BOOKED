# ==============================================================================
# BOOKED - Multi-stage Docker Build
# Optimized for low-resource VPS (1GB RAM)
# ==============================================================================

# ==============================================================================
# Stage 1: Base dependencies
# ==============================================================================
FROM node:20-alpine AS base

WORKDIR /app

# Install build dependencies and openssl for Prisma
RUN apk add --no-cache python3 make g++ curl openssl

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# ==============================================================================
# Stage 2: Dependencies installer
# ==============================================================================
FROM base AS deps

# Limit Node.js memory for low-resource systems
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install all dependencies
RUN npm ci

# ==============================================================================
# Stage 3: API Builder
# ==============================================================================
FROM deps AS api-builder

# Limit memory during build
ENV NODE_OPTIONS="--max-old-space-size=512"

# Copy source code
COPY tsconfig.json ./
COPY apps/api ./apps/api

# Generate Prisma client (use local binary, not npx)
RUN cd apps/api && ../../node_modules/.bin/prisma generate

# Build API
RUN npm run build -w apps/api

# ==============================================================================
# Stage 4: Web Builder
# ==============================================================================
FROM deps AS web-builder

# Limit memory during build
ENV NODE_OPTIONS="--max-old-space-size=512"

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

# Install curl for health checks, openssl for Prisma, and tsx for seed script
RUN apk add --no-cache curl openssl && \
    npm install -g tsx

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
COPY --from=api-builder /app/apps/api/src/types ./apps/api/src/types
# Copy api's node_modules from api-builder (includes .prisma, @prisma, @node-rs if not hoisted)
COPY --from=api-builder /app/apps/api/node_modules ./apps/api/node_modules

# Ensure @prisma/client and @node-rs/argon2 are available for seed script
# tsx resolves modules relative to file location, so they must be in apps/api/node_modules
# IMPORTANT: Only copy from root if NOT already present - the api-builder version is correctly
# configured to find .prisma/client in apps/api/node_modules, root version looks at wrong path
RUN set -e && \
    # First, ensure .prisma/client exists - copy from root if needed (when hoisted)
    if [ ! -d /app/apps/api/node_modules/.prisma/client ]; then \
      if [ -d /app/node_modules/.prisma/client ]; then \
        echo "Copying .prisma/client from root (was hoisted)..." && \
        mkdir -p /app/apps/api/node_modules/.prisma && \
        cp -r /app/node_modules/.prisma/client /app/apps/api/node_modules/.prisma/; \
      else \
        echo "ERROR: .prisma/client not found in either location - prisma generate may have failed" && exit 1; \
      fi; \
    else \
      echo ".prisma/client already exists in apps/api/node_modules"; \
    fi && \
    # Check if @prisma/client exists, copy from root only if missing
    if [ ! -d /app/apps/api/node_modules/@prisma/client ]; then \
      if [ -d /app/node_modules/@prisma/client ]; then \
        echo "Copying @prisma/client from root (was hoisted)..." && \
        mkdir -p /app/apps/api/node_modules/@prisma && \
        cp -r /app/node_modules/@prisma/client /app/apps/api/node_modules/@prisma/; \
      else \
        echo "ERROR: @prisma/client not found in either location" && exit 1; \
      fi; \
    else \
      echo "@prisma/client already exists in apps/api/node_modules"; \
    fi && \
    # Check if @node-rs/argon2 exists, copy from root only if missing
    if [ ! -d /app/apps/api/node_modules/@node-rs/argon2 ]; then \
      if [ -d /app/node_modules/@node-rs/argon2 ]; then \
        echo "Copying @node-rs/argon2 from root (was hoisted)..." && \
        mkdir -p /app/apps/api/node_modules/@node-rs && \
        cp -r /app/node_modules/@node-rs/argon2 /app/apps/api/node_modules/@node-rs/; \
      else \
        echo "ERROR: @node-rs/argon2 not found in either location" && exit 1; \
      fi; \
    else \
      echo "@node-rs/argon2 already exists in apps/api/node_modules"; \
    fi && \
    echo "All modules verified successfully"

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
