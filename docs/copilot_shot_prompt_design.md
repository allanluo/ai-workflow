# Shot Image Prompt Copilot (MVP Design)

## Goal

Make shot image generation reliable by letting users *talk to a copilot* that:

1) pulls canon + scene + shot context automatically  
2) asks only the missing questions  
3) proposes an improved **image prompt** (+ negative prompt) per shot  
4) persists the approved prompt back into the **shot plan** asset

This is intentionally the first “easy” copilot use case: it is bounded (single shot at a time), has a clear success criterion (generated image matches intent), and fits the existing UI (Shots page).

## Current State (Baseline)

### Where the prompt currently comes from

- The Shots page parses `shot_plan` assets into a flat list of shots.
- `ShotEditor` edits fields locally but does not currently persist them back to the plan.
- `PreviewStack` builds a **structured prompt** (CANON / SCENE / SHOT / INSTRUCTIONS) and sends it to:
  - `POST /api/projects/:projectId/images` via `generateCharacterImage({ prompt })`.

### What’s missing

- A user-friendly loop to iteratively refine prompts when the generated image is “off”.
- A place to store “approved prompt” per shot so refresh/reload keeps the intended prompt.
- Copilot context that is “shot-aware” (selected shot, scene, plan).

## User Experience (MVP)

### Entry points

On `ShotsPage`, for the currently selected shot:

- In the preview column: add **Improve Prompt (Copilot)** near the “Prompt (sent to generator)” panel.
- In the Copilot right panel: when a shot is selected, show a dedicated “Shot Prompt” mode above the general chat.

### Flow

1) User selects a shot.
2) User clicks **Improve Prompt (Copilot)**.
3) Copilot displays:
   - the current generation prompt (read-only)
   - extracted context summary (canon highlights, scene highlights, shot camera settings)
   - a small form for “what went wrong?” (free text)
4) Copilot replies with:
   - `prompt_structured` (human readable)
   - `prompt` (string sent to generator)
   - `negative_prompt` (string sent to generator)
   - optional follow-up questions (only if needed)
5) User can:
   - **Apply to shot** (persist)
   - **Apply + Generate image** (persist then run image generation)
   - Edit the prompt manually before applying (optional for MVP)

### Success criteria

- “Apply” updates the shot plan (new asset version).
- Subsequent image generations use the approved shot prompt.
- Refreshing the page preserves the prompt (because it’s stored in the asset, not only local state).

## Data Model (Shot Plan Extensions)

Shot plans already support two shapes:

- `{ shots: Shot[] }`
- `{ scenes: [{ title, shots: Shot[] }] }`

We extend each shot object with optional prompt overrides:

```json
{
  "id": "plan123:manual:abc",
  "shotNumber": 3,
  "description": "Establishing shot – wide, showing the vast grassland before the gunfire.",
  "framing": "Wide",
  "angle": "Eye Level",
  "motion": "Static",
  "continuityNotes": "",

  "image": {
    "prompt_structured": "…human readable…",
    "prompt": "…string sent to generator…",
    "negative_prompt": "…string sent to generator…",
    "width": 1280,
    "height": 720,
    "last_updated_by": "copilot",
    "last_updated_at": "2026-04-16T00:00:00.000Z"
  }
}
```

Rules:

- `description` remains the creative intent / shot description.
- `image.prompt` is the *generator-facing* override and should be used preferentially.
- If `image.prompt` is absent, fall back to the existing assembled prompt.

## Copilot Contract (LLM Output)

For stable UI behavior, the LLM must return strict JSON:

```ts
type ShotPromptSuggestion = {
  prompt_structured: string;   // multi-line, readable
  prompt: string;              // generator-facing prompt
  negative_prompt: string;     // generator-facing negative prompt
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};
```

### System prompt (MVP)

Key constraints:

- Use CANON + SCENE + SHOT faithfully; never contradict canon.
- Keep the prompt *specific and visual*.
- Include camera/framing/angle/motion in the prompt.
- Always include “no text, no watermark, no logos”.
- Output **JSON only** matching `ShotPromptSuggestion`.

## Context Builder (What the copilot sees)

Minimum context per request:

1) **Canon** (latest approved/current canon text asset content)
2) **Scene** (matched by scene title in the latest scene batch)
3) **Shot** (current shot plan item + camera settings)
4) **User feedback** (“what went wrong with the last image?”)
5) Optional: previous image URL and/or a short caption of it (future; MVP can omit image analysis)

## Persistence & Versioning

When the user clicks **Apply**:

- Write a **new asset version** for the `shot_plan` asset (`source_mode: 'copilot'`, `status: 'draft'`, `make_current: true`).
- Only modify the selected shot object (add/replace `image`).
- Preserve the original shot plan structure (direct `shots` or nested `scenes[].shots`).

## Tooling / Integration Points

### Frontend (recommended for MVP)

- Add a “shot-aware” mode to `CopilotPanel` by reading `useSelectionStore().selectedShotId`.
- Add helper utilities:
  - `buildShotPromptContext(projectId, shotId)` → `{ canon, scene, shot }`
  - `applyShotImagePromptToPlan(planAssetId, shotId, suggestion)` → creates new asset version

### Backend (optional next step)

Introduce `POST /api/copilot/shot-prompt/suggest` to:

- centralize the system prompt and JSON schema validation
- handle model selection and safety constraints
- keep the frontend thin

## MVP Implementation Steps

1) **Selection wiring**
   - When selecting a shot in `ShotsPage`, also call `useSelectionStore.getState().selectShot(shot.id)`.
2) **Copilot UI**
   - Add “Improve Prompt (Copilot)” action from the preview prompt panel.
   - Add a compact “Shot Prompt” card to the Copilot right panel when a shot is selected.
3) **LLM call**
   - Reuse `/api/llm/generate` for the first iteration; enforce JSON parsing with a small validator.
4) **Apply**
   - Persist `image.prompt`, `image.negative_prompt`, `image.prompt_structured` into the shot plan asset via `createAssetVersion`.
5) **Use**
   - Update image generation to prefer `shot.image.prompt` when present.

## Out of Scope (for this MVP)

- Image-based critique (“analyze this generated image and fix prompt automatically”)
- Global “style presets” UI
- Automatic bulk prompt improvement for an entire scene or plan
- Copilot session persistence in DB

