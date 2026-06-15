FROM node:18-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Expose port (Render sets PORT automatically)
# EXPOSE 5001

# Start the application
# We run db push before starting the server to ensure the database schema is created/updated
CMD npx prisma db push --accept-data-loss && npm start
