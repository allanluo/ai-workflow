# Full Copilot (Agentic) — Implementation Plan

This plan turns the current Copilot (regex routing + a few skills + chat fallback) into the **full agentic Copilot** described in `docs/copilot_agent_design.md`: context engine + typed tools + planner + executor + state/persistence + safety.

Related docs:
- `docs/copilot_agent_design.md` (target architecture)
- `docs/copilot_agentic_implementation_plan.md` (current MVP phases, shot prompt focus)
- `docs/copilot_shot_prompt_design.md` (first shipped skill)

---

## Current State (What exists today)

In `frontend/src/lib/agent/` we currently have:
- A small **LLM client** (`llmClient.ts`) used by skills.
- A **regex intent parser** + skill dispatcher (`intentParser.ts`).
- A few **skills** (`skills/`) including `improveShotPrompt` that returns a **Proposal**.
- A minimal **apply pipeline** (`applyProposal.ts`) for shot-plan patching.
- UI integration in `frontend/src/components/shell/CopilotPanel.tsx` and selection focus plumbing.
- Local-only **session persistence** + **audit log** (stored in `localStorage`) so refresh doesn’t lose the Copilot state.
- Backend-backed **session persistence** + **audit ingestion** (best-effort sync; `localStorage` remains fallback).

This is a good start, but it is **not yet** the “Planner + Execution” architecture from the design doc.

---

## North Star (Definition of “Full Copilot”)

Copilot behaves like an IDE agent:
1) **Focus-first**: always operates on an explicit target (workflow, node, asset, shot/scene selection).
2) **Context-aware**: automatically gathers relevant project context (and pins versions).
3) **Plans multi-step work**: proposes an execution plan, asks clarifying questions if needed, then executes.
4) **Uses typed tools**: planner chooses from a tool registry; skills compose tools.
5) **Propose → Review → Apply** for writes: every write is previewable, versioned, and confirmable.
6) **Reliable execution**: retries/backoff, progress reporting, cancellation, and safe defaults.

---

## Phase 0 — Stabilize the MVP Substrate (1–2 days)

**Goal:** ensure the current Copilot UX and shot-prompt skill are solid before layering planning.

**Work:**
- Remove ad-hoc debug logging and consolidate Copilot UI error handling.
- Add a single “agent entrypoint” API in the frontend (`copilotController.ts`) so UI isn’t orchestrating flows directly.
- Add smoke tests for shot-plan patching utilities (direct `shots[]` and nested `scenes[].shots`).

**Acceptance:**
- Shot prompt improvement works end-to-end reliably (suggest → proposal → apply → regenerate).
- No regressions in normal chat mode.

---

## Phase 1 — Typed Tool System + Registry (core requirement) (3–5 days)

**Goal:** implement the **Tools vs Skills** separation in `docs/copilot_agent_design.md`.

### 1.1 Add Tool Interfaces + Validation

**Deliverables (new files):**
- `frontend/src/lib/agent/tools/types.ts`
  - `ToolContext`, `ToolResult<T>`, `ToolDefinition<Params, Output>`
  - `category: 'read' | 'write' | 'exec'`
- `frontend/src/lib/agent/tools/registry.ts`
  - `registerTool()`, `getTool()`, `listTools()`
- `frontend/src/lib/agent/tools/validate.ts`
  - runtime schema validation (recommend `zod`)

### 1.2 Implement the First 10–15 Tools (thin wrappers)

Implement atomic wrappers around existing app APIs (read/write/exec), e.g.:
- READ: `fetchProject`, `fetchAssets`, `fetchAsset`, `fetchWorkflows`, `fetchRuns`, `fetchJobStatus`, `searchAssets`
- WRITE: `createAssetVersion`, `deleteAsset`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`
- EXEC: `runWorkflow`, `generateImage`, `generateVideo`, `generateVoice`, `generateSfx`

### 1.3 Refactor Existing Skills to Compose Tools

Example: `improveShotPrompt` should:
- use READ tools (`fetchAsset`, `fetchAssets`) instead of importing API directly
- return a `Proposal` (still OK), but the patch path should be validated

**Acceptance:**
- All skills only call tools (no direct API imports).
- Tools have typed params and typed outputs with runtime validation.
- Planner TOOL_LIST excludes internal tools (proposal-first by default).
 - Destructive actions are proposal-first and require explicit user confirmation on apply.

---

## Phase 2 — Context Engine (Deterministic → Retrieval) (4–7 days)

**Goal:** implement a real `CopilotContext` builder and retrieval step.

### 2.1 Define the Context Object + Version Pinning

**Deliverables:**
- `frontend/src/lib/agent/context/types.ts` with a `CopilotContext` matching the design doc (project, assets, workflows, runs, selection, pinned versions, conversation).
- `frontend/src/lib/agent/context/buildContext.ts`
  - pulls “baseline” project state
  - pins asset/workflow version ids for multi-step runs

### 2.2 Deterministic Retrieval (MVP)

Before embeddings/RAG, implement deterministic relevance:
- always include focused selection (selected shot/plan/node/asset)
- include latest non-deprecated canon/scenes/shots
- include last N runs + last N errors
- cap total context tokens (budgeting)

### 2.3 Optional: Lightweight Semantic Search

If needed, add embeddings later (likely backend-owned), but don’t block on it.

**Acceptance:**
- Any Copilot message gets a structured context bundle.
- Multi-step tasks don’t “drift” due to pinned version ids.

---

## Phase 3 — Planner (LLM → JSON Plan) (5–10 days)

**Goal:** implement the **Planner** described in the design doc.

### 3.1 Define a Plan Schema

**Deliverables:**
- `frontend/src/lib/agent/planner/planSchema.ts` (zod)
- `frontend/src/lib/agent/planner/types.ts`

Recommended minimal plan shape:
```ts
type Plan = {
  intent: string;
  requires_confirmation: boolean;
  questions?: { id: string; question: string; default?: string }[];
  steps: Array<{
    id: string;
    title: string;
    tool: string;
    params: Record<string, unknown>;
    on_error?: 'stop' | 'continue';
  }>;
};
```

### 3.2 Planner Prompt + Routing Policy

**Deliverables:**
- `frontend/src/lib/agent/planner/plannerPrompt.ts`
- `frontend/src/lib/agent/planner/planRequest.ts`
  - decides between:
    - **Direct Action** (single tool / single skill)
    - **Plan + Confirm** (multi-step)
  - includes context summary + tool list

### 3.3 Clarifying Question Loop (Plan → Ask → Continue)

If the planner returns `questions`, Copilot should:
- ask the user
- update context with answers
- re-plan (or fill missing params) and continue
 - preserve the original user request so answers don’t replace intent

**Acceptance:**
- Complex requests produce a valid JSON plan.
- Missing context produces 1–3 questions and resumes after answers.

---

## Phase 4 — Executor + Copilot Controller State Machine (7–14 days)

**Goal:** implement the Tool Executor and the Copilot Controller state machine:
`IDLE → PLANNING → CONFIRMING → EXECUTING → COMPLETED/FAILED`.

### 4.1 Executor Core

**Deliverables:**
- `frontend/src/lib/agent/executor/executePlan.ts`
  - runs tools step-by-step
  - validates tool results
  - retry/backoff policy for transient errors
- `frontend/src/lib/agent/executor/events.ts`
  - emits progress events: started/step_started/step_done/failed/cancelled

### 4.2 UI: Plan Review + Progress

**Deliverables (UI):**
- Copilot panel renders:
  - plan summary + steps
  - “Confirm & Run” button when required
  - per-step progress + logs
  - “Cancel” button

### 4.3 Writes: Proposal-First by Default

Executor rule:
- WRITE tools should typically produce `Proposal` objects (or a proposal step), then require user confirmation to apply.

**Acceptance:**
- Copilot can complete multi-step tasks reliably with visible progress.
- Users can cancel mid-execution.

---

## Phase 5 — Persistence + Task Queue (Backend-backed) (10–20 days)

**Goal:** make Copilot robust across refreshes and support longer-running tasks.

**Deliverables (backend optional but recommended):**
- Persisted sessions: messages, plans, step status
- Task queue: run steps async, store results, stream status (SSE/WebSocket)
- Rate limiting + concurrency control
- Audit log persistence: tool calls/results, proposals, and apply events

**Acceptance:**
- Refresh does not lose Copilot session state.
- Long jobs continue running and report status back to UI.
- Audit log is available cross-refresh and can be downloaded.
 - Copilot plans with exec steps run on the backend and stream `step_update` / `run_update` events.

---

## Phase 6 — Safety, Verification, and Quality Gates (ongoing; do before scaling)

**Goal:** prevent Copilot from becoming a fragile “demo agent”.

**Work:**
- Permission levels + confirmations for destructive actions.
- Audit logging: tool calls, params (redacted), results, pinned version ids.
- “Verify tool result” hooks (especially for generation jobs).
- Add a small eval harness:
  - planner plan validity rate
  - tool success rate
  - user accept/reject rate of proposals

**Acceptance:**
- Dangerous actions always require explicit confirmation.
- Regressions are caught by tests/evals.

---

## Phase 7 — Expand Capability Surface (after hardening)

Add skills using the same architecture:
- Generate scenes from story/canon
- Generate shot plans per scene
- Bulk improve prompts for an entire scene/plan
- Voice-over + SFX generation with structured prompts
- Workflow creation/patching with diffs and verification

**Acceptance:**
- New skills require minimal UI work (rendered via generic “skill card / plan card”).

---

## Recommended Milestones (pragmatic)

- **M1 (Agent Substrate):** Phase 0–1 complete (tool registry, skills compose tools).
- **M2 (Context + Planner):** Phase 2–3 complete (context engine + plan generation + questions).
- **M3 (Execution):** Phase 4 complete (executor + UI progress + proposal-first writes).
- **M4 (Production-grade):** Phase 5–6 complete (persistence + safety + evals).

---

## Notes on Scope / Sequencing

- Don’t start with embeddings/RAG; deterministic retrieval + good pinning gets you most of the value quickly.
- The tool registry is the highest leverage step: it unlocks planning, verification, and testability.
- Keep “writes” proposal-first until you have strong safety + audits.
