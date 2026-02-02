# Frontend Dockerfile for SoldierIQ React/Vite Application
# Multi-stage build: Build stage + Nginx stage

# ============================================
# Stage 1: Build the React/Vite application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build-time environment variables for Vite
# These need to be passed when building the image with --build-arg
ARG VITE_API_URL



# Set environment variables for the build
ENV VITE_API_URL=${VITE_API_URL}


# Build the application (Vite embeds env vars at build time)
RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
