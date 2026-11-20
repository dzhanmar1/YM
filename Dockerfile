# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Server (zero extra dependencies, pure Node runtime)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy built frontend dist and standalone server script
COPY --from=builder /app/dist ./dist
COPY server.mjs ./

EXPOSE 3000

CMD ["node", "server.mjs"]
