# ============================================================================
# Stage 1: Frontend Production Build (Vite + React)
# ============================================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV VITE_APP_MODE=retail
ENV VITE_LOCAL_DEMO=false
RUN npm run build

# ============================================================================
# Stage 2: Backend Production Build (NestJS + Prisma PostgreSQL)
# ============================================================================
FROM node:22-alpine AS backend-builder

WORKDIR /build/backend

RUN apk add --no-cache python3 make g++ openssl

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx prisma generate --schema=prisma/heart.schema.prisma

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ============================================================================
# Stage 3: Unified Production Runtime (API + SPA Same-Origin + PostgreSQL Tools)
# ============================================================================
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl postgresql-client python3 make g++ \
  && mkdir -p /app/backups /app/storage/fiscal /app/uploads

COPY backend/package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

# Prisma Clients gerados para Linux (Alpine musl)
COPY --from=backend-builder /build/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /build/backend/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=backend-builder /build/backend/src/generated ./src/generated

# Código compilado do Backend
COPY --from=backend-builder /build/backend/dist ./dist

# Schemas e Migrações PostgreSQL (necessários para provisionamento e atualização de lojas)
COPY --from=backend-builder /build/backend/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=backend-builder /build/backend/prisma/heart.schema.prisma ./prisma/heart.schema.prisma
COPY --from=backend-builder /build/backend/prisma/migrations ./prisma/migrations
COPY --from=backend-builder /build/backend/prisma/heart-migrations ./prisma/heart-migrations

# Scripts operacionais de migração e bootstrap seguro
COPY --from=backend-builder /build/backend/scripts ./scripts

# Build estático de produção do Frontend (servido na mesma origem)
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

COPY backend/entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

ENV NODE_ENV=production
ENV APP_MODE=retail
ENV FRONTEND_DIST_PATH=/app/frontend/dist
ENV BACKUP_STORAGE_PATH=/data/backups
ENV FISCAL_STORAGE_PATH=/data/fiscal

EXPOSE 3530

ENTRYPOINT ["./entrypoint.sh"]
