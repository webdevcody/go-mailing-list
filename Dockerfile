FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y python-is-python3 build-essential pkg-config && \
    rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y python-is-python3 build-essential pkg-config && \
    rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
