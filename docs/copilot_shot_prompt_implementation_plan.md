# Shot Prompt Copilot — Implementation Plan (Phased)

This document is the implementation plan for the **Shot Image Prompt Copilot** described in:

- `docs/copilot_shot_prompt_design.md`

It’s written as an incremental path to a usable MVP, with clear acceptance criteria per phase.

---

## How This Fits the Agent/Skill Architecture

The implementation should *not* be a set of ad-hoc UI function calls. It should be expressed as a **Copilot skill** (and optionally a small set of internal “tools”) so it:

- reuses the existing `frontend/src/lib/agent` architecture (intent → skill → result)
- keeps UI thin (UI triggers a skill; skill owns the workflow)
- supports multi-turn refinement (“ask missing questions” → “apply”)

### Target structure (frontend MVP)

- **Intent routing**
  - Extend `frontend/src/lib/agent/intentParser.ts` with an `improveShotPrompt` intent (chat phrases like “improve this shot prompt”, “fix this image prompt”, “make it more cinematic”).
- **Skill**
  - Add `frontend/src/lib/agent/skills/improveShotPrompt.ts` (single bounded skill).
  - The skill is responsible for:
    1) building shot-aware context (canon + scene + shot)
    2) calling the LLM to produce strict JSON (`ShotPromptSuggestion`)
    3) returning a structured `SkillResult` with an action payload for the UI
- **Internal tools (optional, but keeps code clean)**
  - `frontend/src/lib/copilot/tools/buildShotPromptContext.ts` (READ tool)
  - `frontend/src/lib/copilot/tools/suggestShotPrompt.ts` (EXEC tool: LLM call + validation)
  - `frontend/src/lib/copilot/tools/applyShotPromptOverride.ts` (WRITE tool: createAssetVersion patch)

### UI responsibilities

- `CopilotPanel` renders `SkillResult.action.payload` for this skill (a “shot prompt card”).
- `ShotsPage` / `PreviewStack` can provide an entry point button, but the “brain” stays in the skill.

---

## Scope (MVP)

**Problem:** users generate a shot image and it’s “wrong”, but there is no guided loop to improve the prompt and persist an approved prompt per shot.

**MVP outcome:**

- For a selected shot, Copilot can propose an improved prompt as **strict JSON**
- User can **Apply** the suggestion to the selected shot (persist into the `shot_plan` asset as a new version)
- The image generator uses the persisted prompt override for future generations

Out of scope for MVP:

- Image analysis / critique from pixels
- Bulk operations (apply to all shots in scene/plan)
- DB persistence of copilot sessions

---

## Baseline (Current Code)

Relevant UI & logic:

- Shot plan list + selection: `frontend/src/pages/ShotsPage/ShotsPage.tsx`
- Image/video generation and prompt assembly: `frontend/src/pages/ShotsPage/PreviewStack.tsx`
- Copilot panel shell (chat + existing intent parser): `frontend/src/components/shell/CopilotPanel.tsx`
- Selection store: `frontend/src/stores/selectionStore.ts`
- Panel store (open/switch to Copilot tab): `frontend/src/stores/panelStore.ts`
- Asset APIs (createAssetVersion etc): `frontend/src/lib/api.ts`

---

## Phase 0 — Wiring + Utilities (foundation)

### Work

1) Extend selection to include shot-plan context:
   - Add `selectedShotPlanAssetId` (string | null)
   - Ensure `selectedShotId` is set when a shot is clicked

2) Share shot plan editing helpers:
   - Parse supported plan shapes:
     - `{ shots: [...] }`
     - `{ scenes: [{ title, shots: [...] }] }`
     - wrapper formats (`content._raw` / `content.text`)
   - Patch a single shot by `shot.id`
   - Write back content preserving wrapper shape

### Files

- Update: `frontend/src/stores/selectionStore.ts`
- Update: `frontend/src/pages/ShotsPage/ShotsPage.tsx`
- Add (recommended): `frontend/src/pages/ShotsPage/shotPlanEditing.ts`
- Update: `frontend/src/lib/agent/types.ts` (extend `SkillContext` with shot selection fields)

### Acceptance

- Selecting a shot updates `selectedShotId` and `selectedShotPlanAssetId`
- Helper can locate and patch a shot by id for both plan shapes and wrappers

---

## Phase 1 — Suggestion Engine (LLM → strict JSON)

### Work

1) Implement `suggestShotImagePrompt(...)`:
   - Calls `/api/llm/generate`
   - Sends a system prompt that forces **JSON only**
   - Includes context:
     - canon summary/highlights
     - scene summary/highlights (matched by shot’s scene title)
     - shot camera settings + description + negative notes
     - user feedback (“what went wrong?”)

2) Validate response:
   - Extract JSON safely
   - Validate required keys: `prompt_structured`, `prompt`, `negative_prompt`

### Files

- Add: `frontend/src/lib/copilot/shotPrompt.ts` (or tool modules under `frontend/src/lib/copilot/tools/`)
- Add: `frontend/src/lib/agent/skills/improveShotPrompt.ts`
- Update: `frontend/src/lib/agent/intentParser.ts` (register the skill + patterns)

### Acceptance

- Given a selected shot + feedback, Copilot returns a parsed `ShotPromptSuggestion`
- Failure states show actionable error messages (and optionally the raw model output in dev)

---

## Phase 2 — UI MVP (generate suggestion for selected shot)

### Work

1) Add a “Shot Prompt” mode UI to Copilot panel:
   - Visible only when a shot is selected
   - Inputs:
     - feedback textarea (“What is wrong with the last image?”)
   - Actions:
     - “Generate suggestion”
   - Outputs:
     - show `prompt_structured`
     - show `prompt` and `negative_prompt`

2) Add entry point from Shots page:
   - “Improve Prompt (Copilot)” button near the existing prompt preview panel
   - Clicking opens/switches right panel tab to Copilot

### Files

- Update: `frontend/src/components/shell/CopilotPanel.tsx`
- Update: `frontend/src/pages/ShotsPage/PreviewStack.tsx`
- Use: `frontend/src/stores/panelStore.ts`

### Acceptance

- With a shot selected, user can generate and view a suggestion in the Copilot panel
- “Improve Prompt (Copilot)” reliably focuses the Copilot tab

---

## Phase 3 — Apply + Persist (write prompt override into shot_plan)

### Work

1) Define shot-level prompt override storage:

```ts
type ShotImageOverrides = {
  prompt_structured: string;
  prompt: string;
  negative_prompt: string;
  width?: number;
  height?: number;
  last_updated_by?: 'copilot' | 'manual';
  last_updated_at?: string; // ISO
};
```

2) Add “Apply to shot” button:
   - Patch only the selected shot object in the shot plan
   - Persist via `createAssetVersion(planAssetId, { source_mode: 'copilot', make_current: true })`

3) Update image generation to prefer persisted overrides:
   - If `shot.image.prompt` exists, use it instead of assembling from canon/scene/shot
   - Continue showing the final “sent to generator” prompt in the preview panel

### Files

- Update: `frontend/src/pages/ShotsPage/PreviewStack.tsx`
- Update: `frontend/src/components/shell/CopilotPanel.tsx`
- Update/Add: `frontend/src/pages/ShotsPage/shotPlanEditing.ts`

### Acceptance

- “Apply” creates a new `shot_plan` asset version with `source_mode: 'copilot'`
- Refreshing the page preserves the shot prompt override (because it’s stored in the asset)
- Image generation uses the override when present

---

## Phase 4 — Apply + Generate (tight loop, optional but high value)

### Work

1) Add “Apply + Generate Image”:
   - Apply overrides
   - Trigger generation immediately with the updated prompt

2) Share shot media state:
   - Move image/video URLs out of `PreviewStack` local component state into a small store
   - Allows Copilot panel to trigger generation and update the same state

### Files

- Add: `frontend/src/stores/shotMediaStore.ts` (recommended)
- Update: `frontend/src/pages/ShotsPage/PreviewStack.tsx`
- Update: `frontend/src/components/shell/CopilotPanel.tsx`

### Acceptance

- One click updates prompt + starts generation
- Generated image shows up in the preview immediately

---

## Phase 5 — Hardening + Backend API (optional)

### Work

1) Backend route to centralize prompts + validation:
   - `POST /api/copilot/shot-prompt/suggest`
   - Zod-validate output schema server-side

2) Tests for plan patching utilities:
   - Nested scenes vs flat shots
   - Wrapper format `_raw` / `text`
   - Stable `shot.id` behavior

### Acceptance

- Suggestion endpoint enforces schema and returns stable JSON
- Utilities have coverage for the tricky plan shapes we already support in UI

---

## Milestones (recommended)

- **M1 (MVP usable):** Phase 0–3 complete
- **M2 (fast iteration loop):** Phase 4 complete
- **M3 (production hardening):** Phase 5 complete
