# --- Build Stage ---
FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Production Stage ---
FROM oven/bun:1-alpine
WORKDIR /app

ENV NODE_ENV=production

# 1. Copy built Nuxt output
COPY --from=build /app/.output .output

# 2. BRING IN THE DRIZZLE CONFIG & SCHEMA (This fixes the missing file error!)
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/server/database ./server/database
COPY --from=build /app/package.json ./

# 3. Ensure drizzle-kit is installed in the final production image
RUN bun install drizzle-kit

EXPOSE 3000

# 4. Fire the start script (which runs push, then boots Nuxt)
CMD ["bun", "run", "start:prod"]