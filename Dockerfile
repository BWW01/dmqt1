FROM oven/bun:1-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app

ENV NODE_ENV=production

# Postgresql-client telepítése a healthcheck-hez
RUN apk add --no-cache postgresql-client

COPY --from=build /app/.output .output
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/server/database ./server/database
COPY --from=build /app/package.json ./

# Átmásoljuk az entrypointot
COPY entrypoint.sh .

# Telepítjük a szükséges eszközöket, átalakítjuk a Windowsos sorvégeket (dos2unix),
# és futtatási jogot adunk a fájlnak.
RUN bun install drizzle-kit pg typescript && \
    apk add --no-cache dos2unix && \
    dos2unix entrypoint.sh && \
    chmod +x entrypoint.sh

EXPOSE 3000

# Biztonságos shell indítási formátum
ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]