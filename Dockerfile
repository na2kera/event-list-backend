FROM node:lts-slim

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy application files
COPY . ./

# Build the application
RUN npm run build

# Set environment variables
ENV PORT 3001
ENV NODE_ENV production

# Expose the port
EXPOSE 3001

# Start the application
CMD [ "npm", "start" ] 