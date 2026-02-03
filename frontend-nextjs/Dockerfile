# SoldierIQ Frontend - Next.js Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for public environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"


ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# iDriveE2 S3-Compatible Storage Configuration (Server-side only)
ARG IDRIVEE2_REGION=us-east-1
ARG IDRIVEE2_ENDPOINT_URL
ARG IDRIVEE2_ACCESS_KEY_ID
ARG IDRIVEE2_SECRET_ACCESS_KEY
ARG IDRIVEE2_BUCKET_NAME=soldieriq-documents

ENV IDRIVEE2_REGION=${IDRIVEE2_REGION}
ENV IDRIVEE2_ENDPOINT_URL=${IDRIVEE2_ENDPOINT_URL}
ENV IDRIVEE2_ACCESS_KEY_ID=${IDRIVEE2_ACCESS_KEY_ID}
ENV IDRIVEE2_SECRET_ACCESS_KEY=${IDRIVEE2_SECRET_ACCESS_KEY}
ENV IDRIVEE2_BUCKET_NAME=${IDRIVEE2_BUCKET_NAME}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
