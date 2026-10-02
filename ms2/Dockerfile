# syntax=docker/dockerfile:1

# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.build.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client BEFORE tsc so all @prisma/client types are available
RUN npx prisma generate

RUN npm run build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# Install production deps + keep prisma CLI for migrations
RUN npm ci --only=production --ignore-scripts && \
    npm install --save-dev prisma --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Generate Prisma client in production image
RUN npx prisma generate

EXPOSE 4000

# Run migrations then start the server.
# On Render the DATABASE_URL env var is injected at runtime.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
