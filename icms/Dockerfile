# ICMS — single-image deploy (Next.js + Prisma/SQLite).
# Designed for free container hosts (Render, Railway, Fly, etc.).
# On boot it creates + seeds the SQLite database, then starts the server.
FROM node:22-slim

WORKDIR /app

# Prisma needs openssl + CA certs on debian-slim.
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install all deps (incl. prisma CLI + tsx, used by the boot seed).
COPY package.json package-lock.json ./
RUN npm ci

# App source + build.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# Runtime config — dev auth (no Entra needed for a demo), local storage, SQLite.
ENV NODE_ENV=production
ENV AUTH_MODE=dev
ENV STORAGE_MODE=local
ENV ALERT_MODE=log
ENV DATABASE_URL="file:./prisma/prod.db"
ENV PORT=3000
EXPOSE 3000

# Create schema + seed demo data on each start, then serve.
CMD sh -c "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx next start -H 0.0.0.0 -p ${PORT:-3000}"
