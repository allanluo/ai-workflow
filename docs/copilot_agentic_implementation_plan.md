# Copilot Agentic Architecture — Implementation Plan (Phased)

This is the implementation plan for bringing the Copilot architecture to **code-assistant parity** (focus-first context, propose→review→apply, typed tools/skills), and shipping the first concrete use case: **Shot Prompt Improvement**.

Related docs:

- `docs/copilot_agent_design.md`
- `docs/copilot_shot_prompt_design.md`
- `docs/copilot_shot_prompt_implementation_plan.md`
- `docs/copilot_full_implementation_plan.md`

---

## North Star (What “like a code assistant” means)

1) **Focus-first context**: every action targets a selected workflow/asset/shot/scene.
2) **Propose → Review → Apply**: Copilot suggests a patch; user applies explicitly.
3) **Typed tools + schema validation**: atomic tools; skills compose tools; UI-facing outputs are validated.
4) **Traceability**: each apply records base version ids + change summary.

---

## Phase 0 — Align Current Code to the Architecture (low risk refactor)

### Goal

Create the minimal “agentic substrate” so new features aren’t implemented as ad-hoc UI calls.

### Work

- Introduce core primitives in `frontend/src/lib/agent`:
  - `Tool` interface + tool registry (`read` | `write` | `exec`)
  - `Proposal` and `ApplyResult` types (JSON Patch style for preview)
  - `AgentContext` focus model (workflow/asset/shotPlan+shot)
- Refactor existing skills to use the registry (thin orchestration).

### Acceptance

- A skill can return a `proposal` without applying it.
- UI can render the proposal and call a single “apply” entrypoint.

---

## Phase 1 — Focus Model + Selection Plumbing (IDE parity)

### Goal

Copilot always knows the “active target” (similar to an active file/selection in an IDE).

### Work

- Extend `useSelectionStore` to cover Copilot-relevant focus targets:
  - `selectedShotId`
  - `selectedShotPlanAssetId`
  - (later) `selectedSceneAssetId` + `selectedSceneIndex`
- Ensure key pages set selection on click:
  - Shots page sets shot + plan focus
  - Scenes page sets scene focus
  - Workflow editor sets workflow/node focus

### Acceptance

- Copilot panel shows “Working on: Shot X / Scene Y / Plan Z” deterministically.

---

## Phase 2 — Proposal / Patch Protocol + Apply Pipeline

### Goal

All Copilot writes become previewable and versioned.

### Work

- Define `Proposal` types:
  - `asset_patch` (JSON Patch against asset content)
  - `workflow_patch` (JSON Patch against workflow definition/version)
- Implement “apply” handlers:
  - Assets: `createAssetVersion(assetId, { source_mode: 'copilot', make_current: true })`
  - Workflows: create workflow version (or draft update) with pinned base version id
- Add guardrails:
  - require confirmation for destructive patches (remove operations)
  - include base version id in apply to prevent drift

### Acceptance

- Copilot can return a proposal and the UI can apply it as a new version.
- If the base version changed, apply fails with a helpful “refresh & retry” message.

---

## Phase 3 — LLM Client + Structured Outputs

### Goal

Standardize how we call the LLM and validate its outputs (so skills are consistent).

### Work

- Create `frontend/src/lib/agent/llmClient.ts` (or similar) that:
  - wraps `/api/llm/generate`
  - supports system prompt + user prompt + context block
  - enforces “JSON only” mode and extracts JSON robustly
- Create small validators for skill outputs (MVP: lightweight runtime checks; later zod).

### Acceptance

- Every skill that returns structured data uses the same extraction/validation path.

---

## Phase 4 — Copilot UI: Skill Renderer + Proposal Review

### Goal

CopilotPanel becomes a “skill UX host” (like an IDE assistant panel).

### Work

- Add a “skill result renderer”:
  - shows proposals (diff/summary)
  - shows an **Apply** button
  - shows status (applying / success / error)
- Keep chat for free-form Q&A, but when an intent maps to a skill:
  - show a structured card instead of a plain text blob

### Acceptance

- A skill can drive a full propose→apply loop entirely inside the Copilot panel.

---

## Phase 5 — Ship the First Skill: Improve Shot Prompt (MVP)

### Goal

Deliver the “simple use case” end-to-end with the agent/skill architecture.

### Skill behavior

1) READ: build context (canon + scene + shot + user feedback)
2) EXEC: call LLM → `ShotPromptSuggestion` (strict JSON)
3) PROPOSE: return an `asset_patch` proposal that updates the selected shot in the shot plan:
   - sets `shot.image.prompt_structured`, `shot.image.prompt`, `shot.image.negative_prompt`
4) APPLY (user clicks): create new asset version for the `shot_plan` asset

### Generator behavior

- Image generation prefers `shot.image.prompt` when present.

### Acceptance

- User can improve a prompt for a selected shot and persist it via Apply.
- Refresh preserves the improved prompt because it’s stored in the asset.

---

## Phase 6 — Hardening (recommended before expanding to more skills)

### Work

- Add audit metadata:
  - model id, prompt hash, base version ids, proposal summary
- Add retries/backoff for LLM calls and apply calls
- Add minimal tests for patching shot plan structures
- (Optional) move suggestion/apply to backend endpoints:
  - `POST /api/copilot/shot-prompt/suggest`
  - `POST /api/copilot/apply`

### Acceptance

- Copilot actions are traceable and robust to transient failures.

---

## Recommended Milestones

- **M1:** Phase 0–2 complete (agentic substrate + propose/apply)
- **M2:** Phase 3–5 complete (shot prompt improvement shipped)
- **M3:** Phase 6 complete (hardening + backend optional)
