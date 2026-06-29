# Multi-stage build for optimal and lightweight Docker image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies) for compiling
RUN npm ci

# Copy codebase
COPY . .

# Build the Vite frontend and compiled CJS Express server
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application assets from the builder stage
COPY --from=builder /app/dist ./dist

# Create a persistent volume directory for storing offline data & files
RUN mkdir -p /app/data

# Expose port 3000
EXPOSE 3000

# Set volume mount for data persistence
VOLUME ["/app/data"]

# Start the built full-stack production server
CMD ["node", "dist/server.cjs"]
