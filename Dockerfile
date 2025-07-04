FROM node:lts-slim

WORKDIR /app

# Install all dependencies (including dev dependencies)
COPY package*.json ./
RUN npm install

# Copy application files
COPY . ./

# Generate Prisma Client
RUN npx prisma generate

# Set Node.js memory limit for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Set environment variables
ENV PORT 3001
ENV NODE_ENV production

# Expose the port
EXPOSE 3001

# Start the application
CMD [ "npm", "start" ] 