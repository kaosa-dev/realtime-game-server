# Realtime Game Server

Production-oriented **server-authoritative multiplayer backend** built to demonstrate modern backend engineering practices used in competitive online games.

This project is **not** a complete game client. It is a polished open-source backend that covers authentication, persistent player progression, lobbies, authoritative realtime sessions, inventory/economy, Redis-backed presence/rate limiting, and CI/CD.

## Features

- JWT access + refresh token authentication with bcrypt password hashing
- Player profiles with XP, coins, and equipment slots
- Persistent inventory (PostgreSQL + Prisma)
- Lobby system: create / join / leave / ready / start with capacity checks
- Authoritative realtime game sessions over WebSocket
- 20 TPS tick loop with snapshot + delta synchronization
- Heartbeat, ping/RTT, disconnect detection, reconnect tokens
- Movement validation and basic anti-cheat (speed / position / input sequencing)
- Coin economy with transactional ledger entries
- Experience leaderboard
- Redis presence, session cache, and rate limiting
- Docker Compose one-command local stack
- Vitest unit/integration tests + GitHub Actions CI

## Load Test Evidence

Live Docker Compose stack (`api` + `postgres` + `redis`) was storm-tested with **autocannon**. The process stayed healthy with **0 crashes**.

| Metric | Result |
| --- | --- |
| Total requests | **659,186** |
| Peak RPS | **17,101** |
| `/health` success | **100%** (320,887 / 320,887) |
| Avg `/health` RPS | **~12,835** |
| After-load health | **ok** · Redis **ready** |
| Process errors | **0** |

Authenticated routes were intentionally Redis rate-limited (~5,000 req/min). Under abuse they returned `429` while the API kept serving — expected production protection, not a crash.

![Load test report hero](docs/load-test/screenshot-report-hero.png)

![Live stack status after load](docs/load-test/screenshot-live-status.png)

![GET /health still ok](docs/load-test/screenshot-health.png)

Reproduce:

```bash
docker compose up --build -d
npm run load:test
npm run load:report
# open docs/load-test/report.html
```

Raw artifacts: [`docs/load-test/results.json`](docs/load-test/results.json) · [`docs/load-test/report.html`](docs/load-test/report.html)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+, TypeScript |
| HTTP | Fastify |
| Realtime | `ws` (WebSocket) |
| Validation | Zod |
| ORM / DB | Prisma + PostgreSQL |
| Cache | Redis (ioredis) |
| Auth | JWT + bcrypt |
| Tests | Vitest |
| Quality | ESLint, Prettier |
| Ops | Docker, Docker Compose, GitHub Actions |

## Architecture

```mermaid
flowchart TB
  Client[Game Client]
  API[Fastify HTTP API]
  WS[WebSocket Gateway]
  App[Application Services]
  Domain[Domain Layer]
  PG[(PostgreSQL)]
  Redis[(Redis)]
  Loop[Game Tick Loop 20 TPS]

  Client -->|REST JWT| API
  Client -->|WS /ws?token=| WS
  API --> App
  WS --> App
  WS --> Loop
  App --> Domain
  App --> PG
  App --> Redis
  Loop --> WS
```

### Clean architecture layout

```mermaid
flowchart LR
  subgraph api [api]
    Routes
    Middleware
    Schemas
  end
  subgraph application [application]
    Services
  end
  subgraph domain [domain]
    Entities
    Repositories[Repository Ports]
    Errors
  end
  subgraph infrastructure [infrastructure]
    PrismaRepos
    RedisInfra[Redis]
    GameEngine[Game Engine]
    WsInfra[WebSocket]
    AuthInfra[JWT/Bcrypt]
  end

  Routes --> Services
  Services --> Repositories
  PrismaRepos --> Repositories
  GameEngine --> WsInfra
```

## Folder Structure

```text
src/
  api/                 # HTTP routes, middleware, Zod schemas
  application/         # Use-case services
  domain/              # Entities, repository ports, errors
  infrastructure/      # Prisma, Redis, JWT, WebSocket, game loop
  modules/             # Feature re-exports
  shared/              # Config, constants, DI container
  app.ts               # Fastify app factory
  server.ts            # Process bootstrap
prisma/
  schema.prisma
  migrations/
tests/
  unit/
  integration/
docker/
.github/workflows/
```

## Quick Start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

Services:

| Service | URL |
| --- | --- |
| API | http://localhost:3000 |
| WebSocket | ws://localhost:3000/ws |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Health | GET /health |

Stop:

```bash
docker compose down
```

## Local Development

Requirements: Node.js 20+, Docker (for Postgres/Redis), npm.

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Useful scripts:

```bash
npm run lint
npm test
npm run build
npm run prisma:studio
```

## API Examples

### Register

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"ace@example.com","username":"Ace","password":"password123"}'
```

### Login

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ace@example.com","password":"password123"}'
```

### Player profile

```bash
curl -s http://localhost:3000/players/me \
  -H "authorization: Bearer $ACCESS_TOKEN"
```

### Inventory

```bash
curl -s http://localhost:3000/inventory \
  -H "authorization: Bearer $ACCESS_TOKEN"

curl -s -X POST http://localhost:3000/inventory/add \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"itemKey":"sword_iron","name":"Iron Sword","quantity":1}'

curl -s -X POST http://localhost:3000/inventory/remove \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"itemKey":"sword_iron","quantity":1}'
```

### Lobby

```bash
curl -s -X POST http://localhost:3000/lobby/rooms \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Ranked Arena","maxPlayers":4}'

curl -s -X POST http://localhost:3000/lobby/rooms/join \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"code":"ABC123"}'

curl -s -X POST http://localhost:3000/lobby/rooms/ready \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"ready":true}'

curl -s -X POST http://localhost:3000/lobby/rooms/start \
  -H "authorization: Bearer $ACCESS_TOKEN"
```

### Economy + Leaderboard

```bash
curl -s http://localhost:3000/economy/balance \
  -H "authorization: Bearer $ACCESS_TOKEN"

curl -s -X POST http://localhost:3000/economy/credit \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"amount":50,"reason":"quest_reward"}'

curl -s 'http://localhost:3000/leaderboard?limit=10'
```

## WebSocket Protocol

Connect:

```text
ws://localhost:3000/ws?token=<ACCESS_TOKEN>
```

### Client → Server

| type | purpose |
| --- | --- |
| `join_session` | Enter a room's authoritative session (`roomId`, optional `reconnectToken`) |
| `input` | Movement intent (`seq`, `dt`, `move`, `look`) |
| `ping` | Latency probe (`clientTime`) |
| `heartbeat` | Keepalive / presence refresh |
| `request_snapshot` | Force full state resync |

Example input:

```json
{
  "type": "input",
  "seq": 42,
  "dt": 0.05,
  "move": { "x": 1, "y": 0, "z": 0 },
  "look": { "x": 0, "y": 1.57, "z": 0 }
}
```

### Server → Client

| type | purpose |
| --- | --- |
| `joined` | Session accepted + reconnect token |
| `snapshot` | Full world state |
| `delta` | Changed fields since previous tick |
| `pong` | Ping response |
| `input_ack` | Last accepted input sequence |
| `heartbeat` | Heartbeat ack |
| `error` | Protocol / auth / validation error |

```mermaid
sequenceDiagram
  participant C as Client
  participant WS as WebSocket Gateway
  participant GS as Game Session
  participant R as Redis

  C->>WS: connect ?token=JWT
  WS->>R: presence online
  C->>WS: join_session
  WS->>GS: addPlayer
  GS-->>C: joined + snapshot
  loop every 50ms
    C->>WS: input
    WS->>GS: enqueue validated input
    GS-->>C: delta/snapshot
  end
  C->>WS: heartbeat/ping
  WS->>R: refresh presence
```

### Authoritative simulation rules

- Server owns position, rotation, velocity, HP, connectivity, and ping
- Clients send intents only; they never write world state
- Inputs are sequenced, rate-limited, schema-validated, and speed-checked
- Full snapshots every ~1s; deltas otherwise

## Database Schema

```mermaid
erDiagram
  User ||--o| Player : has
  Player ||--o| Inventory : owns
  Inventory ||--o{ InventoryItem : contains
  Player ||--o{ RoomMember : joins
  Room ||--o{ RoomMember : has
  Room ||--o{ Session : starts
  Player ||--o{ Session : plays
  Player ||--o| Leaderboard : ranked
  User ||--o{ RefreshToken : issues
  Player ||--o{ CoinTransaction : ledger
```

Core models: `User`, `Player`, `Inventory`, `InventoryItem`, `Room`, `RoomMember`, `Session`, `Leaderboard`, `RefreshToken`, `CoinTransaction`.

## Redis Usage

| Key pattern | Purpose |
| --- | --- |
| `presence:{playerId}` | Online presence with TTL |
| `session:{sessionId}` | Ephemeral session cache |
| `ratelimit:*` | WS + HTTP rate limiting counters |

## Testing & CI

```bash
npm test
npm run lint
npm run build
```

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. Boot Postgres + Redis service containers
2. Install dependencies
3. Prisma generate + migrate
4. Lint, typecheck, test
5. Build TypeScript
6. Build Docker image

## Configuration

See `.env.example` for all knobs:

- `GAME_TICK_RATE` (default `20`)
- `MAX_MOVE_SPEED`
- `HEARTBEAT_TIMEOUT_MS`
- `WS_RATE_LIMIT_PER_SECOND`
- JWT secrets and expiry windows

## Future Improvements

- Horizontal scaling with Redis pub/sub fan-out across game nodes
- Interest management / AOI culling for large maps
- Binary protocols (MessagePack / FlatBuffers) for bandwidth
- Replay recording and anti-cheat telemetry pipelines
- Matchmaking MMR service
- Observability: OpenTelemetry traces, Prometheus metrics, Grafana dashboards
- Kubernetes Helm chart and blue/green deploys

## License

MIT
