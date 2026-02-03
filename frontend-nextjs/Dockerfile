# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Accept build args
ARG NEXT_PUBLIC_API_URL
ARG IDRIVEE2_REGION
ARG IDRIVEE2_ENDPOINT_URL
ARG IDRIVEE2_ACCESS_KEY_ID
ARG IDRIVEE2_SECRET_ACCESS_KEY
ARG IDRIVEE2_BUCKET_NAME

# Set as environment variables for Next.js build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV IDRIVEE2_REGION=$IDRIVEE2_REGION
ENV IDRIVEE2_ENDPOINT_URL=$IDRIVEE2_ENDPOINT_URL
ENV IDRIVEE2_ACCESS_KEY_ID=$IDRIVEE2_ACCESS_KEY_ID
ENV IDRIVEE2_SECRET_ACCESS_KEY=$IDRIVEE2_SECRET_ACCESS_KEY
ENV IDRIVEE2_BUCKET_NAME=$IDRIVEE2_BUCKET_NAME

# Increase Node.js memory for build process
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start the app with increased memory
CMD ["node", "--max-old-space-size=4096", "node_modules/.bin/next", "start", "-p", "3000"]
