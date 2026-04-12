# Implementation Plan v1

## 1. Purpose
Define a practical implementation plan for v1 of the story-to-media production system.

This plan translates the current design docs into an execution sequence for building:
- the desktop shell
- the local backend and database
- the workflow runtime
- the core UI surfaces
- the review, output, and export flow

This plan is intentionally sequence-based rather than date-based.

---

## 2. Planning Assumptions
This plan assumes:
1. v1 is a desktop-first product.
2. the recommended stack in `technical_stack_v_1.md` is accepted
3. the first implementation targets local single-user workflows
4. local AI/media services may be imperfect or partially unavailable during early development
5. correctness of versioning, approvals, and rerun behavior matters more than breadth of features
6. core adapters (text_generate, image_generate) run locally; secondary adapters (TTS, video) can be stubbed or remote
7. target performance: support projects with 1000+ assets, max 4 concurrent jobs on local machine

---

## 3. Implementation Principles
1. Build around the backend contract and persistent data model first.
2. Prefer vertical slices that reach the UI over isolated backend-only work that cannot be exercised.
3. Freeze core versioning and approval rules early.
4. Keep provider-specific AI logic behind service adapters from day one.
5. Start with deterministic, inspectable execution before richer automation.
6. Defer advanced graph editing and complex propagation tooling until the core asset/run model is stable.
7. Distinguish transient vs permanent failures; define retry policies per adapter type.
8. Fail explicitly and safely: stub unavailable services rather than silent degradation.
9. Design DB schema to be migration-agnostic (SQLite → Postgres compatible from day one).

---

## 4. Delivery Strategy
Implement v1 in five milestones:
1. Foundation and repo setup
2. Core project, asset, and workflow authoring
3. Workflow execution and progress observability
4. Review, outputs, and exports
5. Hardening, packaging, and release readiness

Each milestone should end with:
- a runnable product slice
- persisted state that matches the schema and API docs
- tests covering the new critical rules

---

## 5. Milestone 0: Foundation and Repo Setup
Goal:
- establish the app skeleton, local backend, database, and shared contracts

Primary deliverables:
- Electron shell with renderer and backend process startup
- React renderer scaffold
- Fastify backend scaffold under `/api/v1`
- SQLite database bootstrap
- Drizzle schema and migration setup
- shared TypeScript types or shared contract package
- ESLint, Prettier, Vitest, and baseline CI scripts
- local environment configuration for project storage paths and external services

Suggested work:

### Backend
- create Fastify app structure
- add health endpoint
- add typed error envelope and common response helpers
- add Zod validation helpers

### Database
- initialize Drizzle config
- create initial migration pipeline
- create project storage root conventions

### Frontend
- create app shell layout
- add routing skeleton
- add API client foundation
- add TanStack Query provider
- add Zustand store slices for shell/session state

### Electron
- create main process bootstrap
- wire preload bridge
- start and monitor local backend process
- define secure renderer capabilities
- implement IPC validation layer (context isolation enabled)

### Configuration and Local Services
- .env schema and validation (Zod)
- local service discovery: Ollama health check, ffmpeg availability
- graceful degradation when services unavailable
- project storage path convention (~/Documents/.ai-workflow or user-selected)

### API Documentation
- initialize OpenAPI/Swagger spec template
- document response envelopes and error codes
- create API reference markdown

### CI/CD Pipeline
- GitHub Actions (or equivalent): lint, test, build, package
- linting gates (ESLint, Prettier check)
- test coverage baseline (target ≥70% for backend logic)

### Testing
- backend smoke tests
- migration bootstrap test
- renderer shell render smoke test
- local service discovery tests
- config validation tests

Exit criteria:
- app launches locally
- renderer can call backend health endpoint
- database initializes successfully
- migrations run from a clean environment

---

## 6. Milestone 1: Core Project, Asset, and Workflow Authoring
Goal:
- support the basic project model, file intake, asset versioning, and workflow draft lifecycle

Primary deliverables:
- projects CRUD
- file upload and file metadata records
- asset families and asset versions
- workflow definitions and workflow versions
- approval-ready workflow validation
- source, canon, and scenes UI surfaces

Suggested work:

### Backend API
- implement projects endpoints
- implement files endpoints
- implement assets and asset-version endpoints
- implement asset approval and lock endpoints
- implement workflow definition endpoints
- implement workflow validation and workflow version creation endpoints

### Database
- implement `projects`
- implement `file_records`
- implement `assets`
- implement `asset_versions`
- implement `workflow_definitions`
- implement `workflow_versions`

### Frontend
- project home shell
- sources page
- canon page
- scenes page
- workflows page for simple/guided draft editing
- reusable list/detail patterns for assets and workflows

### Rules to validate early
- immutable asset versions
- current working version vs current approved version behavior
- workflow draft vs frozen workflow version separation
- asset approval state separate from lifecycle status

### Testing
- asset version creation tests
- approval behavior tests
- workflow validation tests
- workflow version freeze tests

Exit criteria:
- user can create a project
- upload source files
- create source/canon/scene assets with version history
- create a workflow draft
- validate it
- freeze it into a workflow version

---

## 7. Milestone 2: Workflow Execution and Progress Observability
Goal:
- make frozen workflow versions executable and observable end-to-end

Primary deliverables:
- workflow run creation
- node run persistence
- exact resolved input snapshots
- project event persistence and streaming
- jobs/activity visibility
- first service adapter integrations

Suggested work:

### Backend Runtime
- implement execution engine skeleton
- load workflow version and resolve approval-time inputs
- resolve dynamic asset queries into exact version snapshots at run start
- persist workflow runs and node runs
- implement rerun inheritance rules for input snapshots

### Service Layer
- implement adapter registry
- create stub adapters for development mode
- implement first real adapter path for text generation
- capture normalized service call and generation records

### Eventing
- implement `project_events`
- implement SSE stream endpoint
- implement replayable event history endpoint
- emit workflow, node, export, validation, and asset creation events

### Frontend
- workflow run trigger UI
- live status indicators
- jobs/activity page
- project home latest-run summary
- workflow run detail and node run detail views

### Testing
- run creation tests
- input snapshot resolution tests
- rerun behavior tests
- SSE/event replay tests
- node run persistence tests

Exit criteria:
- user can run an approved workflow version
- progress updates appear live in the UI
- node runs and workflow runs are inspectable
- reruns preserve input snapshot behavior by default

---

## 8. Milestone 3: Review, Outputs, and Exports
Goal:
- complete the user loop from generated assets to reviewed outputs and exported media

Primary deliverables:
- comments and approvals
- validation result persistence and UI
- output families and output versions
- export jobs
- review and diff page
- shots page with preview/media context

Suggested work:

### Backend API
- comments endpoints
- approvals endpoints
- validation endpoints
- outputs and output versions endpoints
- export job endpoints
- export job list endpoint by output version

### Database
- implement `comments`
- implement `approvals`
- implement `validation_results`
- implement `outputs`
- implement `output_versions`
- implement `export_jobs`

### Frontend
- shots page
- outputs page
- review and diff page
- approvals/comments panels
- export job monitoring UI

### Service Layer
- implement ffmpeg render/export adapter
- wire output version to export job creation

### Testing
- approval history tests
- output version creation tests
- export job lifecycle tests
- review page data-loading tests

Exit criteria:
- user can review generated assets
- approve or reject versions
- assemble an output version
- request an export
- monitor export completion

---

## 9. Milestone 4: Hardening, Packaging, and Release Readiness
Goal:
- make the product stable enough for internal v1 usage

Primary deliverables:
- desktop packaging
- error recovery and failure handling polish
- seed data or demo project flow
- performance cleanup for common project sizes
- logging and support diagnostics
- security review of Electron boundaries

Suggested work:

### Product Hardening
- tighten validation messages and conflict handling
- improve empty states and guided paths
- improve retry/cancel behavior for long-running operations
- add project recovery behavior after interrupted runs

### Desktop Packaging
- Electron Forge packaging setup
- production environment config
- path management for project storage
- release packaging scripts

### Security Hardening
- verify Electron context isolation and preload bridge validation
- audit IPC message schema validation
- confirm no shell injection vectors in local service calls
- validate file access is scoped to project directory
- review and document any sensitive data handling

### Testing
- regression suite for critical flows
- packaging smoke test
- project open/reopen persistence test
- migration compatibility test (validate SQLite → Postgres schema map)
- Postgres compatibility validation

Exit criteria:
- packaged desktop build runs successfully
- core create/run/review/export loop works on a clean machine
- major versioning and approval rules are covered by tests
- security audit checklist complete

---

## 10. Cross-Cutting Workstreams
These run across multiple milestones.

### 10.1 Shared Contracts
- shared TypeScript types for API resources (separate npm package or monorepo path)
- shared schema helpers
- shared validation utilities
- OpenAPI spec generation from Fastify routes

### 10.2 Observability and Error Handling
- structured backend logs with context (request_id, workflow_run_id)
- service call logs (adapter name, model, duration, result)
- workflow/node execution summaries
- persisted project events with replay capability
- error classification: transient vs permanent failures
- retry policies per adapter (fail-fast, retry_n_times, retry_with_backoff)

### 10.3 Dev Experience
- reproducible local setup (docker-compose for optional services)
- seed/dev fixtures (sample project, test workflows)
- mock/stub adapters for offline development
- performance profiling gates (project size limits, concurrency targets)

### 10.4 Reproducibility and Portability
- runtime environment recording (adapter versions, model names, seed values)
- adapter version capture with model metadata
- model/version metadata recording in node_runs
- deterministic mode testing
- project export as self-contained archive (future: Milestone 4 or follow-on)
- data backup/restore procedures

### 10.5 Database Migration Strategy
- design all schema for SQLite and Postgres compatibility
- use Drizzle dialect abstraction where needed
- test Postgres migration flow in Milestone 4
- document migration checklist for multi-user deployment

---

## 11. Recommended Build Order by Module
Suggested order:
1. Electron shell, renderer shell, backend bootstrap, config layer, service discovery
2. database schema (Drizzle) and migrations
3. OpenAPI spec skeleton and CI/CD pipeline setup
4. projects, files, assets, asset versions
5. workflows and workflow versions
6. workflow validation
7. workflow execution engine with error handling and retry policies
8. event persistence and SSE/polling delivery
9. jobs/activity UI
10. comments, approvals, and validations
11. outputs and export jobs
12. ffmpeg export path
13. packaging, security hardening, and release readiness

This order gives early working slices while protecting the hardest invariants first.

---

## 12. Critical Risks and Mitigations

### Risk 1: Versioning rules drift during implementation
Mitigation:
- write tests for immutable versions and approval pointers before building advanced UI

### Risk 2: Workflow execution becomes provider-coupled
Mitigation:
- force all provider access through service adapters

### Risk 3: Event model becomes unreliable after reconnect or restart
Mitigation:
- persist project events and support replay by cursor or timestamp

### Risk 4: Frontend state becomes tangled
Mitigation:
- reserve TanStack Query for server state and Zustand for UI/editor state

### Risk 5: External local services are unstable
Mitigation:
- support stub adapters and clear failure surfaces early

### Risk 6: Packaging is deferred too long
Mitigation:
- start Electron packaging checks before the final milestone, not after feature completion

### Risk 7: Local service discovery is fragile or poorly documented
Mitigation:
- implement explicit service discovery with health checks in Milestone 0
- provide clear error messages and fallback stubs
- document expected local tool setup in README

### Risk 8: DB migration to Postgres causes data loss or schema incompatibility
Mitigation:
- use Drizzle dialect abstraction and test Postgres compatibility in Milestone 0
- validate schema migration in Milestone 4 before release

### Risk 9: Error handling becomes inconsistent across workflow engine
Mitigation:
- define error taxonomy and retry policies early (Milestone 2)
- enforce through validation tests before expanding to Milestone 3+

---

## 13. Definition of Done for v1
v1 is complete when the product supports this full loop:
1. create a project
2. upload source materials
3. create and version source/canon/scene assets
4. create a workflow draft
5. validate and freeze a workflow version
6. run the workflow and observe progress live
7. inspect resulting assets and versions
8. approve or reject relevant versions
9. create an output version
10. export preview or final output
11. reopen the project later and inspect the full history of assets, workflow runs, approvals, and exports

---

## 14. Immediate Next Steps
Start with these concrete tasks:
1. finalize the technical stack doc as the implementation baseline
2. scaffold Electron, renderer, backend, and database folders
3. create .env schema and service discovery layer
4. initialize Drizzle with SQLite and Postgres dialect planning
5. create Drizzle schema for the foundational entities
6. implement the Fastify app with health endpoint and error envelope helpers
7. initialize OpenAPI spec template
8. set up GitHub Actions for lint/test/build
9. build the app shell and API client foundation
10. implement projects, files, and assets as the first vertical slice

---

## 15. Optional Follow-On After v1
After v1 is stable, likely next priorities are:
- advanced workflow graph editing
- deeper propagation/impact tooling
- richer compare tools
- template marketplace or reusable workflow packs
- multi-user or remote deployment path
- Postgres migration if concurrency or query complexity requires it
