# Loveable Clone

Loveable Clone is a lightweight coding-agent platform. Each conversation gets its own isolated Kubernetes workspace, user prompts are persisted before agent work starts, jobs are processed asynchronously through Redis, and live progress is streamed back to the browser while the agent edits project files.

The system has moved beyond a simple chat application: it now coordinates a backend API, WebSocket updates, a redis queue job pipeline, Kubernetes conversation pods, an agent worker, an app runner, Postgres persistence, and shared project volumes.

## Current Capabilities

- Create conversations and store them in Postgres.
- Accept user messages and persist them immediately so prompts are not lost if agent execution fails later.
- Create or reuse a dedicated Kubernetes pod for each conversation.
- Inject environment variables, mount a shared PVC, and start the agent and app-runner containers inside the pod.
- Queue work through Redis so messages are not lost while pods are starting.
- Run an agent worker that loads conversation history, reads and edits project files, invokes Gemini/tooling, saves assistant messages, and publishes progress.
- Run a separate app-runner container that manages the generated application's dev server.
- Stream real-time status updates through Redis Pub/Sub, backend subscriptions, WebSockets, and the browser.
- Persist conversation history in Postgres so pods can be recreated and context can be restored from the database.
- Expose generated app previews through Kubernetes Services and Ingress.

---

## System Architecture

The ecosystem consists of several specialized microservices built on k8s cluster communicating via event driven messages:
![alt text](loveable-systems-design.png)

```text
                    Browser
                       |
                HTTP + WebSocket
                       |
                 Backend API
                       |
        +--------------+--------------+
        |                             |
 Save conversation              Subscribe to
   in Postgres                  Redis Pub/Sub
        |                             |
        +--------------+--------------+
                       |
       Ensure conversation pod exists
                       |
                  Redis Queue
                       |
                  Agent Worker
                       |
          Kubernetes conversation pod
                       |
      +----------------+----------------+
      |                                 |
 Agent Worker Container          App Runner Container
      |                                 |
 Gemini + tools                  bun install
 Edit files                      bun run dev
 Save messages                   restart on file changes
 Publish progress                expose preview server
      |                                 |
      +---------- Shared Volume --------+
                       |
            App Runner Dev Server
                       |
              Kubernetes Service
                       |
                    Ingress
                       |
        conversation-id.preview.local
```

## Request Flow

```text
User
 |
 | POST /messages
 v

Backend
 |
 +-- Save conversation
 +-- Save user message
 +-- Ensure Kubernetes pod exists
 +-- Push job to Redis queue
 +-- Return immediately
         |
         v

Agent Worker
 |
 +-- Pick job from Redis queue
 +-- Load conversation history
 +-- Run Gemini
 +-- Execute tools
 +-- Write files
 +-- Save assistant messages
 +-- Publish progress
         |
         v

Redis Pub/Sub
         |
         v
Backend
         |
         v
WebSocket
         |
         v
Browser receives live updates
```

## App Runner

The app runner is a dedicated container in the same pod as the agent. It is responsible only for running the editable application, not for agent logic.

It watches the shared project directory, runs dependency installation, starts `bun run dev`, restarts automatically when files change, exposes the dev server, and provides a preview URL through ingress.

The agent edits files directly on the shared volume. It does not start or manage the dev server itself.

## Repository Layout

```text
apps/
  agent/              Agent worker that processes queued jobs and edits projects
  app-runner/         Container process that installs and runs generated apps
  backend/            Express API for conversations, messages, queues, and pods
  frontend/           React/Vite frontend for the user-facing app
  project/            Editable React/Vite project workspace
  project-template/   Template used for new editable projects
  websocket/          WebSocket server for live browser updates

packages/
  db/                 Drizzle/Postgres schema and database access
  shared/             Shared types, schemas, and utilities

infra/                Observability configuration, including Tempo and OTel collector
k8s/                  Kubernetes namespace, RBAC, PVC inspection, and ingress templates
ops/                  Dockerfiles for agent and app-runner containers
```

## Technology Stack

| Layer                   | Technology                                              |
| ----------------------- | ------------------------------------------------------- |
| Frontend                | React, Vite                                             |
| API                     | Express, TypeScript                                     |
| Database                | PostgreSQL, Drizzle ORM                                 |
| Queue                   | Redis                                                   |
| Live events             | Redis Pub/Sub, WebSockets                               |
| AI                      | Gemini                                                  |
| Runtime/package manager | Bun                                                     |
| Containers              | Docker                                                  |
| Orchestration           | Kubernetes, currently Minikube                          |
| Workspace               | Shared volume inside each conversation pod              |
| Networking              | Kubernetes Services and Ingress                         |
| Observability           | OpenTelemetry, Tempo, Grafana configuration in progress |

## Local Development

Install dependencies:

```sh
bun install
```

Run all workspace dev tasks through Turborepo:

```sh
bun run dev
```

Run the root checks:

```sh
bun run build
bun run lint
bun run check-types
```

Run database commands from the database package:

```sh
bun --filter @repo/db db:generate
bun --filter @repo/db db:push
bun --filter @repo/db db:migrate
bun --filter @repo/db db:studio
```

Start the local observability stack:

```sh
docker compose up
```

This starts Tempo, the OpenTelemetry Collector, and Grafana using the configuration in `infra/`.

## Kubernetes

The Kubernetes setup is designed around one isolated pod per conversation. The backend ensures the pod exists before queueing work for the agent. Each pod contains:

- an agent worker container
- an app-runner container
- a shared volume for project files
- service/ingress routing for preview access

Relevant manifests and templates live in `k8s/`, while container build definitions live in `ops/`.

## Design Decisions

- Conversation history is stored in Postgres, not in process memory.
- User messages are saved before agent execution starts.
- Agent work is asynchronous and queued through Redis.
- Each conversation gets an isolated Kubernetes execution environment.
- The agent and app runner communicate through a shared filesystem, not file copying.
- Live progress is published through Redis Pub/Sub and forwarded over WebSockets.
- Crash recovery works by recreating the pod and reloading state from the database.

## Roadmap

Near-term areas called out for the project:

- Observability with OpenTelemetry SDKs, OTLP export, collector configuration, Loki logs, Prometheus metrics, Grafana dashboards, and distributed tracing.
- Sub agent orchestration via the main agent for context isolation.
- Faster local developer workflow, including better Minikube ergonomics and potentially hostPath mounts for the inner loop.
- Production readiness work such as authentication, authorization, secrets management, autoscaling, resource limits, retry/dead-letter handling, and WebSocket scaling across multiple backend replicas.
