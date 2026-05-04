# Shot Image Source Spec v1

## 1. Purpose
Define the data model and UI flow for shot frame/image sourcing.

This spec covers the following user actions:
- Generate
- Choose Existing
- Upload
- Set Active

The goal is to let each shot support both AI-generated images and user-supplied images without destructive replacement or hidden state.

---

## 2. Product Problem
Today, shot image generation is oriented around a single generated preview.

That is insufficient for professional use because users often need to:
- generate several image options
- reuse an existing project image
- upload a new image from outside the project
- switch between image options without losing prior generations

The system must treat shot imagery as a set of candidates with one active selection.

---

## 3. Core Principle
Each shot should support:
- multiple image candidates
- one active image candidate
- optional approved image candidate

Important rule:
- generating, uploading, or selecting a new image must not delete prior candidates

The user is selecting the image used by the shot, not replacing history.

---

## 4. Scope

### In Scope
- per-shot image candidate model
- generated image candidates
- reused existing project image candidates
- uploaded image candidates
- set active action
- preview and metadata display
- provenance fields

### Out of Scope
- video generation from the selected image
- image approval workflows in full detail
- batch candidate selection across many shots
- asset deduplication policy

---

## 5. Data Model

### 5.1 Shot-Level Fields
Each shot should have:

```ts
interface ShotImageState {
  active_candidate_id: string | null;
  approved_candidate_id?: string | null;
  candidate_ids: string[];
}
```

This state can live:
- inside the shot plan content
- or in a separate shot media state object keyed by shot id

Preferred rule:
- active selection should be persisted in a durable shot-level record, not only local UI storage

### 5.2 Image Candidate Object

```ts
type ShotImageCandidateSource = 'generated' | 'existing_asset' | 'uploaded';

interface ShotImageCandidate {
  id: string;
  shot_id: string;
  source_type: ShotImageCandidateSource;
  title?: string;
  image_asset_id?: string | null;
  image_asset_version_id?: string | null;
  file_id?: string | null;
  image_url: string;
  thumbnail_url?: string | null;
  prompt_text?: string | null;
  negative_prompt_text?: string | null;
  workflow_run_id?: string | null;
  node_run_id?: string | null;
  source_label?: string | null;
  width?: number | null;
  height?: number | null;
  created_at: string;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
}
```

### 5.3 Source Semantics

#### `generated`
Used when the candidate is created by the image generation workflow.

Expected fields:
- `prompt_text`
- `negative_prompt_text`
- `workflow_run_id`
- `node_run_id`
- `image_asset_id` or generated media reference

#### `existing_asset`
Used when the candidate comes from an already known project asset.

Expected fields:
- `image_asset_id`
- `image_asset_version_id`
- `source_label`

#### `uploaded`
Used when the candidate is introduced by direct upload.

Expected fields:
- `file_id`
- optionally a created image asset id
- `source_label`

### 5.4 Active Candidate Rule
Only one candidate may be active per shot.

The active candidate is the one used by:
- shot preview
- timeline assembly
- video generation from image
- narrated preview export

### 5.5 Approved Candidate Rule
Approval and active selection are different concepts.

- `active_candidate_id` = currently used in downstream operations
- `approved_candidate_id` = approved by review

In simple mode, these may point to the same candidate.

---

## 6. Storage Model

### 6.1 Preferred Persistence
The long-term correct model is:
- candidates persisted as asset-like records or shot media records
- active candidate persisted with the shot

### 6.2 Transitional Storage
If the current implementation still uses local storage for preview state, the system may temporarily maintain:
- generated preview URLs locally
- uploaded selection locally

But the product should move toward backend persistence so that:
- active frame survives refresh
- active frame survives export
- active frame is shareable across machines/users

---

## 7. UI Structure

### 7.1 Placement
The shot editor should include an **Image Source** section above or adjacent to the preview panel.

Recommended structure:
- Source toolbar
- Candidate strip/grid
- Active preview
- Candidate metadata/actions

### 7.2 Source Toolbar
Primary actions:
- `Generate`
- `Choose Existing`
- `Upload`

Secondary actions:
- `Set Active`
- `Remove from Shot`
- `Open Asset`
- `Compare`

### 7.3 Candidate Strip
Each candidate card should show:
- thumbnail
- source badge: `Generated`, `Existing`, or `Uploaded`
- active badge if selected
- optional approved badge
- created time
- short source label

### 7.4 Preview Panel
The active candidate should be displayed in the preview area.

If no candidate is active:
- show empty state
- prompt user to Generate / Choose Existing / Upload

---

## 8. UI Flow: Generate

### 8.1 User Intent
User wants the system to generate a new frame/image candidate for the current shot.

### 8.2 Flow
1. User clicks `Generate`
2. System uses the shot prompt and image-generation settings
3. Generation job runs
4. New candidate is created with `source_type = generated`
5. New candidate is appended to the shot candidate list
6. User is prompted to:
   - auto-set active, or
   - review first

### 8.3 Recommended Behavior
Default behavior:
- generated candidate becomes active immediately
- previous active candidate remains in history

Reason:
- fastest iteration loop

### 8.4 Failure Handling
If generation fails:
- do not modify current active candidate
- show job error
- preserve prior candidates

---

## 9. UI Flow: Choose Existing

### 9.1 User Intent
User wants to reuse an image already available in the project.

### 9.2 Source Picker Modal
Clicking `Choose Existing` should open a picker that supports:
- project images
- reference images
- previously generated images
- filtering by tag/type
- search by title

### 9.3 Flow
1. User clicks `Choose Existing`
2. Picker modal opens
3. User selects an image asset/version
4. System creates a new candidate with `source_type = existing_asset`
5. Candidate is appended to the shot candidate list
6. User sets it active immediately or later

### 9.4 Recommended Behavior
Default behavior:
- selecting from the picker creates the candidate and sets it active immediately

Optional advanced behavior:
- checkbox: `Add only, do not set active`

---

## 10. UI Flow: Upload

### 10.1 User Intent
User wants to bring an external image into the shot directly.

### 10.2 Flow
1. User clicks `Upload`
2. File picker or dropzone opens
3. User selects image file
4. File uploads to project storage
5. System creates a shot image candidate with `source_type = uploaded`
6. Candidate is appended to the shot candidate list
7. Candidate becomes active by default

### 10.3 Upload Rules
The upload flow should:
- validate file type
- validate max size
- generate thumbnail
- preserve original filename in metadata

### 10.4 Optional Follow-Up
Uploaded files may optionally also become reusable project assets so that other shots can later pick them via `Choose Existing`.

That is preferred for long-term consistency.

---

## 11. UI Flow: Set Active

### 11.1 User Intent
User wants to switch which candidate the shot actually uses.

### 11.2 Flow
1. User clicks a non-active candidate
2. Candidate detail actions appear
3. User clicks `Set Active`
4. System updates `active_candidate_id`
5. Preview updates immediately
6. Downstream features use the new active candidate

### 11.3 Required Side Effects
After `Set Active`, the following should use the new image:
- shot preview
- shot list thumbnail
- image-to-video generation
- storyboard/slideshow preview
- narrated preview export
- timeline assembly from shot frames

### 11.4 Important Rule
Set Active changes the selected candidate, not the candidate’s content.

It must be a cheap and reversible action.

---

## 12. Candidate Card Actions
Each candidate should support:
- `Set Active`
- `Compare`
- `Open Source`
- `Copy Prompt` for generated candidates
- `Remove from Shot`

### 12.1 Remove from Shot
Remove should:
- detach the candidate from this shot
- not necessarily delete the underlying project asset/file

If the removed candidate is active:
- require confirmation
- switch active selection to:
  - next available candidate, or
  - null if none remain

---

## 13. Visual States

### 13.1 Empty State
Shown when no image candidates exist.

Actions:
- Generate
- Choose Existing
- Upload

### 13.2 Candidate Exists, None Active
This state should be rare.

Behavior:
- show warning banner
- prompt user to set one active

### 13.3 Active Generated
Show:
- generated badge
- prompt metadata
- regenerate nearby

### 13.4 Active Existing
Show:
- existing asset badge
- source asset link

### 13.5 Active Uploaded
Show:
- uploaded badge
- filename and upload source metadata

---

## 14. Provenance Rules
Users should always be able to answer:
- where did this image come from
- was it generated, uploaded, or reused
- which workflow run produced it
- which prompt produced it

Therefore:
- generated candidates should retain prompt and run provenance
- reused candidates should link back to the original asset
- uploaded candidates should show filename and upload time

---

## 15. Integration Rules

### 15.1 Shots Page
Shots page should display the active candidate as the current frame.

### 15.2 Preview Stack
Preview stack should load the active image candidate, not just the latest generated image.

### 15.3 Timeline
Timeline should use the active shot image when building still-image sequences.

### 15.4 Exports
Narrated preview export and other frame-driven exports should use:
- active image candidate
- not arbitrary generated image history

### 15.5 Review
Review may later allow approval of one candidate among many, but the source model should already support that distinction.

---

## 16. Recommended MVP

### MVP Data Rules
- allow multiple per-shot image candidates
- allow one active image candidate
- persist source type and source provenance

### MVP UI Rules
- add `Generate`, `Choose Existing`, and `Upload`
- show candidate thumbnails
- support `Set Active`
- update shot preview from active candidate

### MVP Persistence Rule
At minimum, the active image choice must survive page refresh and export.

---

## 17. Future Extensions
Not required for v1, but supported by this model:
- per-shot image approval
- side-by-side compare
- bulk apply style reference to multiple shots
- candidate scoring/ranking
- branch candidate sets by shot version
- collaborative comments on candidates

---

## 18. Final Design Decision
The correct model is:
- **many image candidates per shot**
- **one active image candidate**
- **source-aware provenance**
- **non-destructive switching**

This gives the app professional flexibility without making the shot model unstable.
