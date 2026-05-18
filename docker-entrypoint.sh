#!/bin/sh
set -e

echo "🚀 Starting Web UI Absensi..."

# Ensure data directories exist
mkdir -p databases/tenants data backups uploads

# Run Prisma migrations for master database
echo "📦 Running master database migrations..."
npx prisma migrate deploy --schema=prisma/schema-master.prisma 2>/dev/null || \
  npx prisma db push --schema=prisma/schema-master.prisma --accept-data-loss 2>/dev/null || \
  echo "  ⚠ Master migration skipped (may already be up to date)"

# Seed master database if empty
echo "🌱 Checking if seed is needed..."
if [ ! -f databases/master.sqlite ] || [ ! -s databases/master.sqlite ]; then
  echo "  → Seeding master database..."
  npx ts-node prisma/seed-master.ts 2>/dev/null || echo "  ⚠ Master seed skipped"
fi

echo "✅ Initialization complete. Starting application..."

# Execute the main command (next start)
exec "$@"
