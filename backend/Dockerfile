FROM node:20-alpine

WORKDIR /app

# Install sqlite3 tools (for database operations and debugging)
RUN apk add --no-cache sqlite curl

# Copy package files
COPY package*.json ./

# Install dependencies during build
RUN npm install --production=false

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY seed.cjs ./
COPY seed-devices.cjs ./
COPY startup.sh ./

# Build TypeScript
RUN npm run build

# Make startup script executable
RUN chmod +x ./startup.sh

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Run startup script which seeds DB and starts server
CMD ["./startup.sh"]
