# Multi-stage build for optimal and lightweight Docker image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies) for compiling
RUN npm install --no-audit --no-fund

# Copy codebase
COPY . .

# Build the Vite frontend and compiled CJS Express server
RUN npm run build

# Prune node_modules to only include production dependencies
RUN npm prune --omit=dev

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package*.json ./

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

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
