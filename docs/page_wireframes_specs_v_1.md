# Page Wireframes & Specs v1

## 1. Purpose
Define concrete page-level layouts and interactions for key pages.

This bridges shell design → actual implementation.

Format:
- layout zones
- key components
- primary actions
- state variations

---

## 2. Home Page

### Layout
- Center: Dashboard grid
- Right Panel: Copilot / Activity

### Sections
- Project Summary (title, description)
- Latest Workflow Run (status, progress)
- Recent Assets (scenes/shots)
- Recent Outputs
- Pending Approvals

### Primary Actions
- Upload Source
- Create Workflow
- Run Latest Approved Workflow

### States
- Empty → onboarding prompts
- Active → dashboard cards

---

## 3. Sources Page

### Layout
- Left: File/Source list
- Center: Preview + metadata
- Right: Inspector

### Components
- Upload Dropzone
- Source List (table/cards)
- File Preview (text/image/audio)

### Actions
- Upload
- Create Source Asset
- Link to Canon

---

## 4. Story & Canon Page

### Layout
- Left: Canon categories
- Center: Editor
- Right: Versions / Validation

### Components
- Canon List (Premise, Characters, etc.)
- Rich Text / Structured Editor
- Version History Panel

### Actions
- Edit
- Save New Version
- Approve
- Lock Fields

---

## 5. Scenes Page

### Layout
- Left: Scene list/cards
- Center: Scene detail
- Right: Inspector / Validation

### Components
- Scene Card (title, purpose, status)
- Scene Editor (structured fields)

### Actions
- Add Scene
- Reorder (drag)
- New Version
- Inspect Shots

---

## 6. Shots Page (Critical)

### Layout
- Left: Shot list
- Center: Shot Inspector + Preview stack
- Right: Validation / Versions

### Components
- Shot List (thumbnail + status)
- Prompt Editor
- Camera Settings
- Image/Video Preview

### Actions
- Regenerate
- Edit Prompt
- Compare Versions
- Lock Fields
- Validate

### States
- No media → show generate CTA
- With media → preview + controls

---

## 7. Workflows Page

### Layout
- Top: Workflow + Version selector
- Center: Mode-dependent
  - Simple: stages
  - Guided: step blocks
  - Advanced: graph
- Right: Versions / Copilot
- Bottom: Run status

### Components
- Stage Cards
- Node Editor (advanced)

### Actions
- Validate
- Freeze Version
- Approve
- Run
- Duplicate

---

## 8. Outputs Page

### Layout
- Left: Output list
- Center: Output detail
- Right: Inspector / Approval

### Components
- Output Cards (type, status)
- Settings panel

### Actions
- Create Output
- New Version
- Approve
- Export

---

## 9. Timeline & Preview Page

### Layout
- Top: Output selector
- Center: Player + Timeline
- Right: Comments / Inspector
- Bottom: Render status

### Components
- Video Player
- Timeline Bars
- Track Layers (video/audio/caption)

### Actions
- Play Preview
- Replace Clip
- Toggle layers
- Export

---

## 10. Review Page

### Layout
- Center: Diff/Compare
- Right: Approvals / Comments

### Components
- Side-by-side compare
- Change highlights

### Actions
- Approve
- Reject
- Comment

---

## 11. Activity Page

### Layout
- Center: Runs / Jobs list
- Right: Inspector

### Components
- Workflow Runs Table
- Node Runs
- Logs viewer

### Actions
- Rerun
- Retry
- Open related asset

---

## 12. Cross-Page Patterns

### Status Badges
- Draft
- Approved
- Running
- Failed
- Warning

### Version Selector
Always visible in detail headers

### Empty States
- clear CTA to next step

### Loading States
- skeleton loaders

---

## 13. MVP Priority

Must build first:
1. Home
2. Sources
3. Canon
4. Scenes
5. Shots
6. Workflows (simple/guided)

Second phase:
7. Outputs
8. Review
9. Timeline
10. Activity

---

## 14. Open Questions
- Should shots page include inline timeline preview?
- Should workflow run status overlay appear globally?
- How deep should compare tools go in v1?
