# Technical Stack v1

## 1. Purpose
Define the recommended implementation stack for v1 of the story-to-media production system.

This document turns the architecture direction from the other design docs into concrete technology choices for:
- desktop shell
- frontend application
- local backend and API
- database and file storage
- workflow execution runtime
- local AI and media service integration
- testing and developer tooling

The goal is to reduce ambiguity before implementation starts.

---

## 2. Decision Summary
Recommended v1 stack:
- TypeScript across frontend, backend, and Electron layers
- Electron for the desktop shell
- Electron Forge for packaging and distribution
- React for the renderer UI
- Vite for frontend build and dev server
- Tailwind CSS for styling
- React Router for routing
- TanStack Query for server state and caching
- Zustand for local UI and editor state
- Fastify for the local backend API
- Zod for request, response, and JSON payload validation
- SQLite for v1 metadata storage
- Drizzle ORM with `better-sqlite3`
- local filesystem storage for media binaries
- Server-Sent Events for live progress and activity in v1
- Ollama, ComfyUI, Piper/Fish/CosyVoice, and ffmpeg behind service adapters
- Vitest for unit/integration tests
- Playwright for end-to-end desktop-flow coverage where practical

---

## 3. Design Drivers
This stack is chosen to match the product requirements already established in the design docs:
1. v1 is desktop-first, not cloud-first.
2. The system depends on local AI/media tooling and local file access.
3. Metadata must be versioned, queryable, and reproducible.
4. The UI has both complex editor state and backend-owned server state.
5. Long-running jobs need observable progress with minimal operational complexity.
6. v1 should stay simple enough to build quickly while preserving a migration path to multi-user or remote deployment later.

---

## 4. Recommended Architecture Shape
Use a three-layer desktop architecture:

### 4.1 Electron Main Process
Responsibilities:
- application lifecycle
- native window management
- app-level configuration
- secure process orchestration
- starting and stopping the local backend
- filesystem path resolution

This layer should remain thin.

### 4.2 Renderer Application
Responsibilities:
- all user-facing UI
- page routing
- editor interactions
- event subscriptions
- view state and client-side caching

The renderer should not talk directly to Ollama, ComfyUI, or SQLite.

### 4.3 Local Backend Process
Responsibilities:
- REST API
- workflow orchestration
- database access
- file metadata management
- event streaming
- service adapter invocation
- validation and approval logic

This backend should be the single authority for project state.

---

## 5. Frontend Stack

### 5.1 Core Choices
- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Zustand

### 5.2 Why This Combination
- React is the most practical choice for a state-heavy desktop UI with many list/detail/editor views.
- Vite keeps iteration speed high and works well with Electron renderer development.
- Tailwind is fast enough for v1 and fits the existing UI design docs.
- React Router is sufficient for the page model already described in the docs.
- TanStack Query should own backend-fetched resources such as assets, workflow runs, outputs, comments, and approvals.
- Zustand should own local interaction state such as panel layout, selection, editor drafts, compare mode, and transient session state.

### 5.3 Frontend Rules
- keep server state out of Zustand unless there is a clear reason
- do not let components call local services directly
- use typed API client modules instead of ad hoc fetch calls across the app
- keep renderer-side filesystem access behind Electron preload or backend APIs, not direct Node access from arbitrary components

---

## 6. Backend Stack

### 6.1 Core Choices
- Node.js
- TypeScript
- Fastify
- Zod

### 6.2 Why Fastify
- lightweight and fast for a local API server
- straightforward TypeScript support
- suitable for JSON APIs, file endpoints, and event streaming
- simpler operational model than a larger full-stack framework

### 6.3 API Shape
- REST-style JSON API under `/api/v1`
- multipart upload endpoints for files
- Server-Sent Events for progress and activity streams in v1

Use SSE first because v1 mainly needs one-way event delivery from backend to UI:
- workflow progress
- node state changes
- export progress
- validation creation
- asset/version creation events

WebSocket can be added later if bidirectional real-time behavior becomes necessary.

---

## 7. Database and Storage Stack

### 7.1 Metadata Database
- SQLite
- Drizzle ORM
- `better-sqlite3`

### 7.2 Why This Choice
- SQLite matches the desktop-first, single-user-local-first model
- Drizzle gives typed schema definitions and migrations without forcing a heavy abstraction layer
- `better-sqlite3` is a pragmatic fit for a local app process and keeps the stack simple

### 7.3 Storage Rules
- store metadata in SQLite
- store flexible content payloads as validated JSON fields where appropriate
- store heavy media binaries on the local filesystem, not in SQLite
- keep file records in the database and actual files in project-scoped storage folders

### 7.4 Migration Path
Design the schema so Postgres migration remains possible later:
- stable ids
- explicit version tables
- application-level JSON validation
- avoid SQLite-only assumptions in business logic

---

## 8. Workflow and Service Runtime

### 8.1 Local Services
Recommended local service stack:
- Ollama for text and structured generation
- ComfyUI for image generation workflows
- ComfyUI for video generation workflows
- Piper, Fish, or CosyVoice for TTS
- ffmpeg for timeline rendering, assembly, transcoding, and export

### 8.2 Integration Model
Do not couple workflow nodes directly to provider-specific payloads.

Use service adapters:
- `ollama_text_adapter`
- `comfyui_image_adapter`
- `comfyui_video_adapter`
- `tts_speech_adapter`
- `ffmpeg_render_adapter`

This preserves:
- provider swap flexibility
- reproducibility metadata
- logging consistency
- testability of node execution

### 8.3 Execution Runtime
Keep the execution engine in the backend process for v1.

Responsibilities:
- load workflow versions
- resolve exact input snapshots
- enqueue node work
- persist workflow runs and node runs
- emit project events
- write created outputs and service-call records

---

## 9. Validation and Data Contracts
Use Zod at the boundaries where incorrect data would create long-lived corruption or hard-to-debug drift:
- API request validation
- API response shaping where useful
- workflow definition validation
- node config validation
- JSON field validation before persistence
- service adapter request normalization

Do not rely only on TypeScript types for persisted or external data.

---

## 10. Packaging and Distribution

### 10.1 Packaging
Use Electron Forge for:
- local development ergonomics
- packaging for macOS, Windows, and Linux
- update distribution readiness later

### 10.2 Practical Note
If the Forge + Vite plugin path proves unstable during implementation, keep Electron Forge for packaging and decouple the renderer build strategy rather than changing the whole desktop shell choice.

---

## 11. Testing Strategy
Recommended tooling:
- Vitest for unit tests
- Vitest integration tests for backend modules, validation, and adapters
- Playwright for end-to-end flows where it is practical to drive the desktop app or its critical UI paths

High-priority test areas:
- workflow validation
- input snapshot resolution
- asset/version approval rules
- rerun behavior
- event streaming
- export job lifecycle
- service adapter normalization

---

## 12. Developer Tooling
Recommended supporting tools:
- pnpm for workspace package management
- ESLint
- Prettier
- TypeScript project references or equivalent monorepo configuration

Suggested repository shape:
- `frontend/` for renderer app
- `backend/` for local API and workflow engine
- `services/` for adapters and provider-specific integrations
- `database/` for schema, migrations, and seed helpers
- `docs/` for architecture and implementation docs

---

## 13. Alternatives Not Chosen for v1

### 13.1 Next.js or Full Web-First Frameworks
Not recommended for v1 because the product is local-desktop-first and depends heavily on local process orchestration and filesystem access.

### 13.2 Postgres as the Starting Database
Not recommended for v1 because it adds setup and operational cost without enough product benefit for the first local implementation.

### 13.3 Redux Toolkit as the Primary State Layer
Possible, but not preferred as the main local-state tool for v1.

Reason:
- the project has substantial UI/editor state, but not enough global mutation complexity to justify heavier state ceremony from day one

Redux Toolkit remains a valid fallback if state complexity grows beyond what Zustand handles cleanly.

### 13.4 WebSocket as the Default Event Channel
Not the first choice for v1 because SSE is simpler and the current event model is mostly backend-to-frontend.

### 13.5 Python as the Main App Backend
Possible, but not preferred for this repo direction.

Reason:
- using TypeScript across Electron, frontend, and backend reduces context switching
- Electron integration and typed API contracts are simpler in one language stack
- Python can still appear inside specialized service wrappers later if a provider requires it

---

## 14. Final Recommendation
Use this concrete stack for v1:

- Desktop shell: Electron + Electron Forge
- Frontend: React + TypeScript + Vite + Tailwind + React Router
- Frontend state: TanStack Query + Zustand
- Backend: Node.js + TypeScript + Fastify + Zod
- Database: SQLite + Drizzle ORM + `better-sqlite3`
- Event transport: SSE
- Media storage: local filesystem with DB-backed metadata
- AI/media integrations: Ollama + ComfyUI + Piper/Fish/CosyVoice + ffmpeg via adapters
- Tests: Vitest + Playwright

This is the most coherent v1 stack for the documented product shape.

---

## 15. Open Questions
1. Should the local backend run as a separate child process or inside Electron main for the first implementation?
2. Which TTS provider should be the default local adapter in v1: Piper, Fish, or CosyVoice?
3. Should Drizzle migrations be the only schema migration path, or should raw SQL migrations also be retained?
4. Do we want a shared `packages/shared` module for API types and schema helpers from day one?
