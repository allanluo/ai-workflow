# Shots Page — Pixel-Level Spec (v1)

## 1. Overall Layout Grid
- Sidebar: 240px (collapsible → 64px)
- Shot List: 280px
- Main Panel: flexible (min 600px)
- Right Panel: 360px (resizable)
- Full height: 100vh

---

## 2. Top Toolbar (56px)
**Left**
- Breadcrumb: Project / Shots / Scene / Shot / Version
- Version badge: Approved / Draft / Needs Revision

**Right**
- Regenerate
- Compare
- Validate
- Lock Fields
- Save New Version

---

## 3. Shot List Panel (280px)
- Header: Shots + Scene filter + Add button
- Shot Item (72px height)
  - Thumbnail (56x56)
  - Title + subtitle
  - Status badges (Approved / Warning)

---

## 4. Main Panel — Split Layout
Left: Editor (50%)
Right: Preview (50%)

---

## 5. Shot Editor
### Prompt
- Textarea (120px)

### Negative Prompt
- Textarea (80px)

### Camera Settings
- Shot Type
- Angle
- Motion
- Duration

### Continuity
- Character + Environment chips

### Controls
- Save Draft
- New Version
- Lock Fields
- Reset

---

## 6. Preview Stack
### Tabs
- Image / Video

### States
- Empty → Generate button
- Image → preview + regenerate/download
- Video → player controls

---

## 7. Right Panel (360px)
Tabs:
- Copilot
- Versions
- Validation
- Inspector

---

## 8. Activity Dock
- Collapsed: running status
- Expanded: Runs / Jobs / Logs

---

## 9. Key Flows
### Generate
Click regenerate → run job → preview updates → new version

### Fix Drift
Validation warning → Copilot suggestion → apply → regenerate

### Compare
Side-by-side versions

---

## 10. Core UX Principles
1. Preview always visible
2. Versioning always tracked
3. Regenerate never overwrites
4. Validation guides action
5. Copilot produces actions, not chat
