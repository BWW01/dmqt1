#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until pg_isready -h kkv-postgres -p 5432 -U "${DB_USER:-admin}"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up - running migrations..."
bun run db:push

echo "Starting application..."
exec bun run start:prod