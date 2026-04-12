# AI Workflow - Story-to-Media Production System

A hybrid creative platform where AI proposes workflows, users approve and edit them, and the system executes them reproducibly. Supports multiple inputs (story text, scripts) and outputs (films, music videos, etc.).

## Overview

The system is designed around these core principles:

1. **AI generates workflows, not raw outputs** — AI proposes production workflows that users can inspect, edit, and approve
2. **Approved workflows are frozen contracts** — Workflow versions become immutable snapshots that enable reproducible execution
3. **Users maintain control** — Manual overrides always win; users decide what the system proposes
4. **Everything is versioned** — All important assets, workflows, and outputs maintain full version history
5. **Execution is reproducible and auditable** — Every run is recorded with exact inputs, models, parameters, and results

## Quick Start

### For Development

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env

# Run all services (backend, frontend, electron)
pnpm dev

# Or run individually:
pnpm dev:backend      # Terminal 1
pnpm dev:frontend     # Terminal 2
pnpm dev:electron     # Terminal 3 (after others start)
```

See [SETUP.md](./SETUP.md) for detailed setup instructions, local service configuration (Ollama, ffmpeg), and troubleshooting.

### For First-Time Users

1. **Read the docs**: Start with [Implementation Plan](./docs/implementation_plan_v_1.md) for architecture
2. **API Reference**: Check [API Reference](./docs/api_reference.md) for available endpoints
3. **Try the UI**: Open the Electron app and create a test project
4. **API Docs**: Visit http://localhost:8787/api/docs for Swagger UI

## Architecture

### Tech Stack

- **Frontend**: Electron + React + Vite
- **Backend**: Fastify + Node.js
- **Database**: SQLite (local), Postgres-compatible (future)
- **State**: React Query (server state) + Zustand (UI state)
- **Services**: Ollama (LLM), ffmpeg (media), extensible adapters

### Directory Structure

```
ai-workflow/
├── backend/              # Fastify API server
│   └── src/
│       ├── routes/       # API endpoints
│       ├── runtime/      # Execution engine
│       ├── services/     # Service adapters & discovery
│       └── __tests__/    # Test suite
├── frontend/             # React + Electron app
│   ├── src/              # React components
│   ├── electron/         # Electron main process
│   └── dist-electron/    # Built Electron app
├── database/             # Drizzle ORM schema
│   └── src/
│       ├── schema.ts     # Database tables
│       ├── client.ts     # SQLite client
│       └── (operations)  # CRUD operations
├── services/             # Service adapter contracts
├── docs/                 # Design & API documentation
└── storage/              # Local project files
```

## Key Features (Milestone 0)

✅ **Foundation & Infrastructure**
- Fastify API with versioned endpoints (`/api/v1`)
- SQLite database with Drizzle ORM
- Error handling with classification (transient/permanent/user errors)
- Retry policies (fail_fast, retry_3x, retry_with_backoff)
- Local service discovery (Ollama, ffmpeg health checks)
- Swagger/OpenAPI documentation
- GitHub Actions CI/CD pipeline

✅ **Core Resources**
- Projects CRUD
- File uploads with metadata
- Asset families with immutable versions
- Workflow definitions and frozen versions
- Execution engine with input/output snapshots

✅ **UI Shell**
- Electron desktop app with secure preload bridge
- React Router navigation
- React Query for server state sync
- Zustand for UI/shell state
- App shell layout (sidebar, toolbar, workspace, panels)

## Development Commands

```bash
# Install & setup
pnpm install

# Development
pnpm dev                 # All services in parallel
pnpm dev:backend        # Backend API only
pnpm dev:frontend       # Web renderer only
pnpm dev:electron       # Electron app

# Quality
pnpm lint               # ESLint
pnpm check              # TypeScript type check
pnpm test               # Vitest suite
pnpm build              # Production build

# Database
pnpm db:generate        # Generate Drizzle migrations
pnpm db:migrate         # Run migrations
```

## API Examples

### Create Project

```bash
curl -X POST http://localhost:8787/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Story Project",
    "description": "A film adaptation",
    "primary_output_type": "film"
  }'
```

### Health Check

```bash
curl http://localhost:8787/api/v1/health
```

### Access Swagger UI

Open http://localhost:8787/api/docs in your browser.

## Configuration

Environment variables in `.env`:

```env
# Backend
PORT=8787
PROJECT_STORAGE_ROOT=./storage/projects

# Services
OLLAMA_ENABLED=true
OLLAMA_ENDPOINT=http://localhost:11434

FFMPEG_ENABLED=true
FFMPEG_ENDPOINT=http://localhost:9000

# Execution
MAX_CONCURRENT_JOBS=4
DEFAULT_RETRY_POLICY=fail_fast
ENFORCE_REPRODUCIBILITY=false
```

See `.env.example` for all options.

## Roadmap

### Milestone 1: Core Authoring (In Progress)
- Asset versioning & approval workflows
- Workflow draft editing and validation
- Project sources, canon, and scenes UI

### Milestone 2: Execution & Observability
- Workflow run execution engine
- Live progress streaming via SSE
- Service adapter integrations (Ollama, ffmpeg)
- Event persistence and replay

### Milestone 3: Review & Exports
- Comments and approval workflows
- Output assembly from assets
- Export job orchestration
- Validation results UI

### Milestone 4: Hardening & Release
- Desktop packaging (Electron Forge)
- Error recovery and resilience
- Performance optimization
- Security review and hardening

## Documentation

- **[Implementation Plan](./docs/implementation_plan_v_1.md)** — Detailed phased development roadmap
- **[API Reference](./docs/api_reference.md)** — All endpoints and schemas
- **[Setup Guide](./SETUP.md)** — Local dev environment and troubleshooting
- **[Core System Design](./docs/core_system_design_v_1.md)** — Architecture principles
- **[Database Schema](./docs/database_schema_v_1.md)** — Data model
- **[Backend API Design](./docs/backend_api_design_v_1.md)** — API contract
- **[Execution Engine](./docs/execution_engine_design_v_1.md)** — Runtime model
- **[Frontend Architecture](./docs/frontend_state_and_page_architecture_v_1.md)** — UI state & pages
- **[UI Navigation](./docs/ui_navigation_and_shell_design_v_1.md)** — Shell layout
- **[Service Adapters](./docs/service_adapter_and_node_contract_v_1.md)** — Capability contracts

## Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test -- health.test.ts
```

Current test coverage includes:
- ✅ Health endpoint smoke tests
- ✅ Database bootstrap tests
- ✅ Error classification and retry policies
- ⏳ API endpoint tests (coming soon)
- ⏳ Workflow execution tests (coming soon)

## Local Services Setup

### Ollama (LLM)

```bash
# Install
brew install ollama

# Run
ollama serve

# Pull model
ollama pull qwen3:8b

# Test
curl http://localhost:11434/api/tags
```

### ffmpeg

```bash
# Install
brew install ffmpeg

# Verify
ffmpeg -version
```

### Docker Compose

For containerized services:

```bash
# With Ollama + ffmpeg
docker-compose -f docker-compose.dev.yml --profile with-services up

# With PostgreSQL (future migration testing)
docker-compose -f docker-compose.dev.yml --profile with-database up
```

## Performance Targets

- Support projects with 1000+ assets
- Max 4 concurrent jobs on local machine
- Health check response < 100ms
- Event stream heartbeat every 15s

## Security

- Electron context isolation enabled
- IPC message validation (preload bridge)
- File access scoped to project directory
- No shell injection in service calls

## Contributing

1. Follow the architecture in [implementation_plan_v_1.md](./docs/implementation_plan_v_1.md)
2. Maintain error handling patterns from [`backend/src/runtime/errors.ts`](./backend/src/runtime/errors.ts)
3. Add tests for new features
4. Update relevant docs
5. Run linting and tests before submitting

## License

TBD

## Support

- **Issues**: Check [SETUP.md](./SETUP.md) troubleshooting section
- **API Docs**: http://localhost:8787/api/docs (Swagger)
- **Architecture**: See [docs/](./docs/) folder

---

**Version**: v0.1.0 (Milestone 0: Foundation)  
**Last Updated**: April 2024
