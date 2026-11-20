# ============================================================================
# Stage 1: Frontend Build Stage
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src

RUN npm run build

# ============================================================================
# Stage 2: Production Lightweight Runtime Stage (ZimaOS Private Edition)
# ============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8070
ENV DATA_DIR=/app/data

RUN apk add --no-cache su-exec

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server ./server

RUN mkdir -p /app/data /app/sample-data && chown -R node:node /app

VOLUME ["/app/data"]

EXPOSE 8070

CMD ["sh", "-c", "chown -R node:node /app/data && exec su-exec node node server/index.js"]
