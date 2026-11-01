FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ openssl

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npx prisma generate --schema=prisma/heart.schema.prisma

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ---- Production ----
FROM node:22-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl postgresql-client python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/heart.schema.prisma ./prisma/heart.schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY --from=builder /app/prisma/heart-migrations ./prisma/heart-migrations
COPY --from=builder /app/scripts ./scripts

COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

EXPOSE 3530

ENTRYPOINT ["./entrypoint.sh"]
