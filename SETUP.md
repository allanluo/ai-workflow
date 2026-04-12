# Local Development Setup Guide

This guide helps you set up the story-to-media production system for local development.

## Prerequisites

- **Node.js**: v20.x or later (LTS)
- **pnpm**: v10.0.0
- **SQLite3**: Usually pre-installed on macOS/Linux

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the environment template:

```bash
cp .env.example .env
```

Update `.env` as needed (most defaults work for local development).

### 3. Run in Development Mode

**Terminal 1: Backend**
```bash
pnpm dev:backend
```

**Terminal 2: Frontend (Renderer)**
```bash
pnpm dev:frontend
```

**Terminal 3: Electron (in another terminal when both are running)**
```bash
pnpm dev:electron
```

Or run all in parallel:
```bash
pnpm dev
```

### 4. Access the App

- **Electron App**: Opens automatically when you run `pnpm dev:electron`
- **Web Browser**: http://localhost:5173 (renderer development)
- **API**: http://localhost:8787/api/v1
- **API Docs**: http://localhost:8787/api/docs (Swagger UI)
- **Health Check**: http://localhost:8787/api/v1/health

## Setting Up Local Services (Optional)

### Ollama (LLM Service)

For local LLM support, install Ollama:

```bash
# macOS (via Homebrew)
brew install ollama

# Or download from
# https://ollama.ai/download
```

Start Ollama:

```bash
ollama serve
```

Pull a model (e.g., Qwen):

```bash
ollama pull qwen3:8b
```

Check health:

```bash
curl http://localhost:11434/api/tags
```

### ffmpeg (Media Processing)

For local media processing (optional, runs via system ffmpeg if available):

```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

Verify:

```bash
ffmpeg -version
```

### Optional: Docker Compose Setup

For a complete local environment with all services:

```bash
docker-compose -f docker-compose.dev.yml up
```

See `docker-compose.dev.yml` for details.

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test -- --watch

# Coverage
pnpm test -- --coverage
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Type check
pnpm check

# Format (if Prettier is configured)
pnpm format
```

### Building for Distribution

```bash
# Build all packages
pnpm build

# Build Electron app for packaging
cd frontend
pnpm build:electron
pnpm build
```

## Database Management

### Initialize Database

Database automatically initializes on first backend start. To reset:

```bash
rm -f database/data/ai-workflow.sqlite
pnpm dev:backend  # Will reinitialize
```

### Generate Drizzle Migrations

```bash
pnpm db:generate
```

### Run Migrations

```bash
pnpm db:migrate
```

## Debugging

### Backend Debugging

Start with Node Inspector:

```bash
node --inspect-brk ./node_modules/.bin/tsx src/server.ts
```

Then open `chrome://inspect` in Chrome.

### Frontend Debugging

- Use Vite dev tools in browser
- Use React DevTools browser extension
- Electron DevTools open by default in dev mode

### Database Inspection

View SQLite database:

```bash
sqlite3 database/data/ai-workflow.sqlite

# Common queries
sqlite> SELECT name FROM sqlite_master WHERE type='table';
sqlite> SELECT COUNT(*) FROM projects;
```

## Troubleshooting

### Port Already in Use

If port 8787 (backend) or 5173 (frontend) is in use:

```bash
# Change backend port
PORT=8888 pnpm dev:backend

# Change frontend port (in frontend/.env or vite.config.ts)
```

### Database Lock

If you get "database is locked":

```bash
# Kill any existing db connections
pkill -f "ai-workflow"

# Remove lock file if exists
rm -f database/data/ai-workflow.sqlite-wal
```

### Service Not Available

If Ollama or ffmpeg services aren't available:

- Backend will emit clear warnings in logs
- Check service health: `curl http://localhost:11434/api/tags`
- Backend gracefully handles missing services with stub adapters

### Dependencies Not Installing

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall
pnpm install --force
```

## Architecture Overview

```
ai-workflow/
├── backend/          # Fastify API server
├── frontend/         # React + Electron app
├── database/         # Drizzle schema and client
├── services/         # Service adapter layer
├── docs/             # Documentation
└── storage/          # Local project storage
```

## Next Steps

1. Create a project via API or UI
2. Upload source materials
3. Create and edit assets
4. Build and run workflows
5. Check `/docs/implementation_plan_v_1.md` for feature roadmap

## Useful Links

- **API Reference**: `./docs/api_reference.md`
- **Implementation Plan**: `./docs/implementation_plan_v_1.md`
- **Design Docs**: `./docs/`

## Support

For issues:
1. Check logs in terminal output
2. Review error messages in browser console (F12)
3. Check database state with SQLite inspector
4. Review error code taxonomy in `./backend/src/runtime/errors.ts`
