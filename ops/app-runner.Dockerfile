FROM oven/bun:alpine
WORKDIR /app

COPY package.json bun.lock ./

COPY apps/app-runner/package.json ./apps/app-runner/
COPY packages/ ./packages/

RUN bun install

COPY apps/app-runner ./apps/app-runner

CMD ["bun", "apps/app-runner/src/index.ts"]