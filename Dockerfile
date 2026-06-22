FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build / runtime image
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3001
ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
