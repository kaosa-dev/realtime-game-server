#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting realtime-game-server..."
exec node dist/server.js
