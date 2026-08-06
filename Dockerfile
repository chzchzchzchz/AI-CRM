# TargetDash — one-command self-host image.
# Multi-stage: build with full deps, run with a slim runtime.
#
#   docker build -t targetdash .
#   docker run -p 3333:3333 targetdash      # zero-config demo at http://localhost:3333
#
# For real data, pass env at runtime (see ADMIN_SETUP.md). JWT_SECRET is required —
# outside demo mode the server refuses to start with a missing or placeholder one,
# because sessions signed with a public value are forgeable by anyone:
#   docker run -p 3333:3333 \
#     -e DEMO_MODE=false \
#     -e DATABASE_URL=... \
#     -e JWT_SECRET="$(openssl rand -base64 48)" \
#     targetdash

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Install deps first (better layer caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build client (dist/public) + server bundle (dist/index.js)
COPY . .
RUN pnpm build

# ---- runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DEMO_MODE=true
ENV PORT=3333
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Production deps only (server bundle imports them at runtime — esbuild keeps packages external)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# App bundle + assets, the committed demo seed, and config
COPY --from=build /app/dist ./dist
COPY demo-db.seed.json ./demo-db.seed.json
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY config ./config
# For real-DB setups, create the schema in the running container with:
#   docker compose exec app pnpm db:push

EXPOSE 3333
CMD ["node", "dist/index.js"]
