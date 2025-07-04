# Build stage
FROM node:lts-slim AS build

WORKDIR /app

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=512"

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files and install all dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

# Copy source code
COPY . ./

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:lts-slim AS production

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files and install only production dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Expose the port
EXPOSE 3001

# Start the application
CMD [ "npm", "start" ] 