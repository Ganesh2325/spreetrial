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

# Expose port (Render sets PORT automatically, typically we use 5002 locally)
ENV PORT=5002
EXPOSE 5002

# Start the application
CMD ["npm", "start"]
