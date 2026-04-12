# Current Implementation Plan

## Purpose

Define the practical implementation plan for the current repository state.

This plan is the execution-oriented companion to:
- `docs/workflow_master_design_v_1.md`
- `docs/workflow_implementation_plan_v_1.md`
- `docs/implementation_gap_analysis.md`

Use this document as the current build order for the app.

---

## Source of Truth

| Category | Document |
|---|---|
| Workflow design | `docs/workflow_master_design_v_1.md` |
| Workflow plan | `docs/workflow_implementation_plan_v_1.md` |
| Current gaps | `docs/implementation_gap_analysis.md` |
| Gap plan | `docs/implementation_plan_v_2.md` |
| Historical full-product plan | `docs/implementation_plan_v_1.md` |

---

## Current Goal

Ship a usable v1 loop where a user can:

1. Create or select a project
2. Upload source material
3. Create or edit a workflow
4. Validate, freeze, and approve the workflow
5. Run the workflow and inspect node progress
6. Review outputs
7. Create output versions
8. Export preview or final media

---

## Immediate Next Tasks

The highest-value next tasks, in priority order:

1. Fix DB bootstrap for `asset_links` and `asset_tags`
2. Fix review approval integration
3. Standardize frontend API usage
4. Fix workflow run association in the workflows page
5. Define the first concrete node library metadata module
6. Implement template-based workflow creation

---

## Implementation Phases

Work proceeds across five phases:

### Phase 1 — P0 Correctness Fixes

**Goal:** Remove runtime-broken behavior before deeper feature work.

**Work Items:**
- Bootstrap `asset_links` and `asset_tags` in the database
- Fix review approval so UI approval actually updates asset approval state
- Standardize frontend API usage on the shared API client and configured base URL
- Fix workflow run association in the workflows page
- Fix root test workflow so `pnpm -r test` is usable

**Why First:**
These issues break documented flows. Deeper product work will be misleading if core behavior is still wrong.

**Exit Criteria:**
- Clean DB supports links/tags routes
- Review approval works end to end
- Workflow run history appears correctly in the workflow surface
- Frontend pages use one API access pattern
- Repo-level test command no longer fails for avoidable reasons

---

### Phase 2 — Workflow Product Completion

**Goal:** Make workflow the real center of the app instead of a partially structured form.

**Work Items:**
- Replace remaining raw workflow editing patterns with structured guided editing
- Add workflow template picker and template creation flow
- Define and implement the first reusable node library
- Implement guided step editing backed by the shared workflow schema
- Implement advanced graph canvas with:
  - Draggable nodes
  - Visible ports
  - Drag-to-connect edges
  - Node inspector
- Keep guided and advanced modes synchronized
- Harden workflow validation and approval UX

**Initial Workflow Node Library:**

| Node | Role |
|---|---|
| Input | Accepts source material |
| Planning | Structures the generation approach |
| Generation | Produces content |
| Validation | Checks output quality |
| Assembly | Combines generated content |
| Export | Produces final deliverable |

**Exit Criteria:**
- Non-technical users can author workflows in guided mode
- Advanced users can inspect and edit the real graph
- Workflows are created from reusable nodes and templates, not ad hoc page logic
- Workflow draft, frozen version, and approved version states are clear and trustworthy

---

### Phase 3 — Workflow Execution and Output Integration

**Goal:** Connect workflow authoring to real execution, review, and export.

**Work Items:**
- Harden workflow run and node run inspection
- Persist and expose exact resolved inputs and effective node config
- Improve runtime observability:
  - Generation records
  - Service call records
  - Validation result persistence if adopted
- Create output versions from workflow runs
- Connect workflow results to review surfaces
- Connect outputs to export jobs cleanly
- Create asset links automatically for generated and assembled assets

**Exit Criteria:**
- A workflow run clearly produces inspectable assets and output candidates
- Users can move from workflow run → review → output → export without broken jumps
- Provenance from output back to workflow version and node runs is visible

---

### Phase 4 — UI Surface Integration

**Goal:** Replace scaffolds and mock-backed pages with real integrated product surfaces.

**Work Items:**
- Connect Shots page to real assets, version history, and generation state
- Connect Timeline/Preview page to real outputs and export state
- Connect Activity page to real workflow runs, node runs, and export jobs
- Connect Diff/Compare to real version data
- Connect right-panel tabs: Versions, Validation, Comments, Inspector
- Implement real global search across assets, workflows, outputs, and runs

**Exit Criteria:**
- Major UI surfaces are no longer mock-backed
- Users can navigate real project state from any major page
- Shell panels support actual workflow and asset inspection work

---

### Phase 5 — Hardening

**Goal:** Make the app stable enough for repeated use on local projects.

**Work Items:**
- Improve error states and empty states
- Improve event replay and reconnect behavior
- Harden rerun and retry behavior
- Add missing backend and frontend tests around core flows
- Improve performance for larger projects
- Clean up stale plan/docs references after implementation stabilizes

**Exit Criteria:**
- The end-to-end workflow loop is dependable on a normal local setup
- Major regressions are covered by automated tests
- Planning docs reflect actual implementation state

---

## Definition of Done

This plan is complete when:
- Core runtime flows are no longer broken
- Workflow is the real authoring and execution center of the app
- Output and export flows are connected to workflow results
- Mock-backed pages are replaced with real data-driven behavior
- The documented v1 loop works end to end

---

## Summary

The current repo should not be developed as a collection of disconnected pages.

The implementation center should be:

1. **Correctness first** — fix what is broken
2. **Workflow second** — build the authoring and execution core
3. **Output/review integration third** — connect runs to real artifacts
4. **Shell/page completion fourth** — replace scaffolds with real data

That sequence gives the app a coherent core instead of a broad but fragmented surface.
