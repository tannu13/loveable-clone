FROM oven/bun:alpine
WORKDIR /app

COPY package.json bun.lock ./

COPY apps/agent/package.json ./apps/agent/
COPY packages/ ./packages/

RUN bun install

COPY apps/agent ./apps/agent

CMD ["bun", "apps/agent/src/index.ts"]