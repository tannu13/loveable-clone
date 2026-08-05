FROM oven/bun:alpine
WORKDIR /app

# install git and set default committer details
RUN apk add --no-cache git
ENV GIT_AUTHOR_NAME="Agent Bot"
ENV GIT_AUTHOR_EMAIL="bot@internal.local"
ENV GIT_COMMITTER_NAME="Agent Bot"
ENV GIT_COMMITTER_EMAIL="bot@internal.local"

COPY package.json bun.lock ./

COPY apps/agent/package.json ./apps/agent/
COPY packages/ ./packages/

RUN bun install

COPY apps/agent ./apps/agent

CMD ["bun", "apps/agent/src/index.ts"]