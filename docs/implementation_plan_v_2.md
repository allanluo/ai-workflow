# Implementation Plan v2

## Purpose

Address the remaining gaps after the initial v1 implementation pass.

This document is not a clean-sheet plan anymore. The repo already contains:

- backend/runtime scaffolding that mostly works
- shell/state/page scaffolding across the frontend
- several UI surfaces that exist structurally but are still mock-backed or only partially integrated

This plan therefore focuses on:

- broken integrations
- scaffolded-but-incomplete UI surfaces
- missing persistence/runtime pieces
- cleanup required to satisfy the intended v1 loop

See `docs/implementation_gap_analysis.md` for the detailed review snapshot.

For workflow-specific design and delivery, the primary source of truth is now:

- `docs/workflow_master_design_v_1.md`
- `docs/workflow_implementation_plan_v_1.md`

This document should therefore be read as:
- a repo-state recovery and gap-closure plan
- a secondary implementation tracker for non-workflow surfaces
- a companion to the dedicated workflow docs, not a replacement for them

---

## 1. What's Already Implemented (v1)

### Backend (M0-M4) - Mostly Implemented

- Fastify API with health, projects, files, assets, workflows, reviews routes
- SQLite database with Drizzle ORM
- Workflow execution engine with job polling
- SSE events for progress streaming
- Service adapters for LLM, TTS, Image, Video generation
- Project recovery on restart
- Structured diagnostics logging
- Node-level rerun endpoint

Current caveat:

- some backend features are only partially wired, especially links/tags bootstrap, review approval integration, and validation/generation observability

### Frontend (M0-M4) - Scaffolded Across Most Major Surfaces

- React + Vite + Tailwind + TanStack Query + Zustand scaffold
- App shell, sidebar, top toolbar, right panel, and bottom dock
- Zustand stores for app, panel, selection, and event state
- ProjectHomePage with project list and creation
- Project routes for sources, canon, scenes, shots, workflows, outputs, timeline, review, activity, and compare
- Basic workflow run triggering with SSE progress
- Empty states and loading patterns
- Initial shots, timeline, activity, diff, versions, comments, validation, and search components

Current caveat:

- many of the above surfaces still use mock data or placeholder behavior instead of real backend integration

---

## 2. What's Missing

Workflow note:

- the app's core workflow product model, authoring modes, node library direction, and phased workflow delivery plan are now defined in the dedicated workflow docs
- the items below should be interpreted as repo-state gaps relative to that workflow direction, not as the canonical workflow spec

### Backend Gaps

1. Asset links and asset tags DB bootstrap are incomplete
2. Review approval flow is split across two APIs and is not fully integrated
3. Generation records and service calls logging
4. Full validation results persistence/API
5. Automatic asset-link creation on generation

### Frontend Gaps

1. **Shots Page** exists but is mock-backed and not connected to real data/versioning
2. **Timeline/Preview Page** exists but is mock-backed and not connected to outputs/export flow
3. **Activity/Jobs Page** exists but is mock-backed and not connected to real runs/jobs
4. **Diff/Compare UI** exists but is mock-backed and not connected to version data
5. **Right-panel tabs** exist but versions/comments/validation are still placeholder implementations
6. **Global search and shell polish** exist only as initial scaffolds
7. **Workflow run association** in the workflows page is wired incorrectly
8. **Frontend API usage** is inconsistent; some pages bypass the shared API client
9. **Outputs/export flow** is only partially surfaced in the UI

---

## 3. Milestones

### M5: Shell Architecture (1-2 days)

**Goal:** Complete the desktop shell with sidebar navigation, right context panel, and bottom activity dock.

#### Deliverables

- AppShell component with 3-panel layout
- ProjectSidebar with navigation tree
- TopToolbar with project name, breadcrumbs, actions
- RightContextPanel with tabbed content
- BottomActivityDock for runs/jobs
- Zustand stores for panel state

#### Work Items

**State Management**

- Create `panelSlice` - sidebar open/collapsed, right panel open/collapsed, active tab
- Create `selectionSlice` - selectedProjectId, selectedPage, selectedAssetId, etc.
- Create `userModeSlice` - simple/guided/advanced mode
- Create `eventSlice` - recentEvents, activeToasts, runProgress

**Shell Components**

```
frontend/src/components/shell/
├── AppShell.tsx           # Root layout (sidebar + main + right panel)
├── ProjectSidebar.tsx     # Left nav with project tree
├── TopToolbar.tsx         # Project header, breadcrumbs, actions
├── RightContextPanel.tsx   # Tabbed context panel
├── BottomActivityDock.tsx  # Runs, jobs, logs, notifications
├── CopilotPanel.tsx       # AI assistant tab
├── InspectorPanel.tsx     # Metadata tab
├── VersionsPanel.tsx      # Version history tab
├── ValidationPanel.tsx    # Validation results tab
└── CommentsPanel.tsx      # Comments tab
```

**Navigation Structure**

- Home
- Sources
- Story & Canon
- Scenes
- Shots
- Workflows
- Outputs
- Timeline & Preview
- Review
- Activity
- Exports

#### Exit Criteria

- Sidebar collapses to icon rail
- Right panel shows context-appropriate tabs
- Bottom dock shows active runs
- Panel state persists in Zustand

---

### M6: Shots Page (2-3 days)

**Goal:** Implement the critical Shots page per the 108-line pixel spec.

#### Deliverables

- Shot list panel with thumbnails
- Shot inspector with prompt/negative prompt editing
- Camera settings controls
- Preview stack with image/video tabs
- Continuity refs display
- Version history panel
- Regeneration workflow

#### Work Items

**Shot List Panel (280px)**

```
frontend/src/pages/ShotsPage/
├── ShotsPage.tsx          # Main container
├── ShotListPanel.tsx      # Left shot list (280px)
├── ShotListItem.tsx       # Individual shot card
├── ShotEditor.tsx         # Center editor (split 50/50)
├── PromptEditor.tsx       # Prompt/negative prompt
├── CameraSettings.tsx      # Shot type, angle, motion
├── ContinuityChips.tsx    # Character/environment refs
├── PreviewStack.tsx       # Right preview panel
├── ImagePreview.tsx       # Image preview tab
├── VideoPreview.tsx       # Video preview tab
└── ShotToolbar.tsx        # Top toolbar with actions
```

**Shot Inspector Fields**

- Prompt (textarea, 120px)
- Negative Prompt (textarea, 80px)
- Camera Settings:
  - Shot Type (dropdown)
  - Angle (dropdown)
  - Motion (dropdown)
  - Duration (number)
- Continuity:
  - Character refs (chips)
  - Environment refs (chips)

**Shot States**

- No media → Show generate CTA
- Image generated → Preview + regenerate/download
- Video generated → Player controls

**Right Panel Tabs**

- Copilot
- Versions
- Validation
- Inspector

#### Exit Criteria

- Shot list shows thumbnails with status badges
- Prompt editing creates new version on save
- Preview stack updates after generation
- Version history shows all shot versions

---

### M7: Activity & Jobs Page (1-2 days)

**Goal:** Monitor workflow runs, node runs, and export jobs.

#### Deliverables

- Workflow runs table with status
- Node runs details with logs
- Export jobs monitoring
- Logs viewer
- Retry/rerun actions

#### Work Items

```
frontend/src/pages/ActivityPage/
├── ActivityPage.tsx        # Main container
├── RunsTable.tsx          # Workflow runs list
├── RunDetailPanel.tsx     # Selected run details
├── NodeRunList.tsx        # Node runs for selected run
├── NodeRunCard.tsx        # Individual node run
├── LogsViewer.tsx         # Collapsible logs
├── ExportJobsList.tsx     # Export jobs monitoring
└── ActivityToolbar.tsx    # Filters and actions
```

#### Exit Criteria

- All workflow runs visible with status
- Node runs show inputs/outputs
- Logs expandable per node
- Retry actions work

---

### M8: Timeline & Preview Page (2-3 days)

**Goal:** Review assembled media and timeline structure.

#### Deliverables

- Video player with controls
- Timeline visualization (simplified)
- Track layers display
- Export actions

#### Work Items

```
frontend/src/pages/TimelinePage/
├── TimelinePage.tsx        # Main container
├── OutputSelector.tsx      # Top output selector
├── VideoPlayer.tsx         # Center player
├── TimelineTrack.tsx       # Timeline visualization
├── TrackLayers.tsx         # Video/audio/caption layers
├── ClipCard.tsx           # Individual clip
└── TimelineToolbar.tsx     # Export actions
```

**Simplified Timeline (v1)**

- Show clip order as cards/bars
- Duration display per clip
- Basic layer visualization
- Not full NLE quality

#### Exit Criteria

- Video player plays output preview
- Timeline shows clip structure
- Export button triggers job

---

### M9: Diff & Compare UI (1-2 days)

**Goal:** Compare versions of assets, workflows, and outputs.

#### Deliverables

- Text diff for canon/story assets
- Structured field diff for scenes/shots
- Side-by-side media compare
- Workflow version diff

#### Work Items

```
frontend/src/components/diff/
├── DiffViewer.tsx          # Main diff container
├── TextDiff.tsx            # Text content diff
├── FieldDiff.tsx           # Structured field diff
├── MediaCompare.tsx         # Side-by-side images/video
├── VersionSelector.tsx      # Baseline vs candidate
└── DiffSummary.tsx         # Change summary
```

#### Exit Criteria

- Can compare any two versions
- Shows changed fields highlighted
- Media side-by-side view works

---

### M10: User Modes & Polish (1-2 days)

**Goal:** Implement user mode switching and polish.

#### Deliverables

- Mode switcher in toolbar (Simple/Guided/Advanced)
- Mode-adaptive UI (hide graph in simple)
- Breadcrumb navigation
- Global search

#### Work Items

**Mode Adaptation**

- Simple: Hide workflow graph, show stages only
- Guided: Show workflow steps with editable config
- Advanced: Show node graph and execution details

**Global Components**

- ModeSwitcher.tsx
- Breadcrumb.tsx
- GlobalSearch.tsx
- GlobalCreateMenu.tsx

#### Exit Criteria

- Mode switcher changes UI density
- Breadcrumbs show current location
- Search finds assets/workflows/outputs

---

### M11: Backend Completions (1 day)

**Goal:** Fill remaining backend gaps.

#### Work Items

1. Asset links table + API (`/projects/:id/links`)
2. Asset tags table + API (`/projects/:id/tags`)
3. Node-level rerun (`POST /node-runs/:id/rerun`)
4. Generation records for observability

---

## 4. Recommended Implementation Order

```
Week 1:
├── M5: Shell Architecture (priority)
├── M5: Zustand stores (prerequisite)
└── M11: Asset links (low effort, high value)

Week 2:
├── M6: Shots Page (critical feature)
└── M6: Preview components

Week 3:
├── M7: Activity Page
├── M8: Timeline Page
└── M9: Diff/Compare UI

Week 4:
├── M10: User Modes & Polish
├── Integration testing
└── Documentation
```

---

## 5. Component Inventory

### Shell Components (M5)

- [ ] AppShell
- [ ] ProjectSidebar
- [ ] TopToolbar
- [ ] RightContextPanel
- [ ] BottomActivityDock
- [ ] CopilotPanel
- [ ] InspectorPanel
- [ ] VersionsPanel
- [ ] ValidationPanel
- [ ] CommentsPanel

### Shots Components (M6)

- [ ] ShotListPanel
- [ ] ShotListItem
- [ ] ShotEditor
- [ ] PromptEditor
- [ ] CameraSettings
- [ ] PreviewStack
- [ ] ImagePreview
- [ ] VideoPreview

### Activity Components (M7)

- [ ] RunsTable
- [ ] RunDetailPanel
- [ ] NodeRunCard
- [ ] LogsViewer
- [ ] ExportJobsList

### Timeline Components (M8)

- [ ] VideoPlayer
- [ ] TimelineTrack
- [ ] TrackLayers
- [ ] ClipCard

### Diff Components (M9)

- [ ] DiffViewer
- [ ] TextDiff
- [ ] MediaCompare
- [ ] VersionSelector

### Shared Components

- [ ] ModeSwitcher
- [ ] Breadcrumb
- [ ] GlobalSearch
- [ ] StatusBadge
- [ ] VersionSelector
- [ ] Toast

---

## 6. State Store Shape

```typescript
// frontend/src/stores/

// appSlice - global app state
{
  currentProjectId: string | null,
  selectedPage: PageId,
  userMode: 'simple' | 'guided' | 'advanced',
  connectionStatus: 'connected' | 'connecting' | 'disconnected',
  theme: 'light' | 'dark'
}

// selectionSlice - resource selection
{
  selectedAssetId: string | null,
  selectedAssetVersionId: string | null,
  selectedWorkflowId: string | null,
  selectedWorkflowVersionId: string | null,
  selectedWorkflowRunId: string | null,
  selectedOutputId: string | null,
  selectedShotId: string | null,
  selectedSceneId: string | null
}

// panelSlice - panel visibility
{
  sidebarCollapsed: boolean,
  rightPanelOpen: boolean,
  rightPanelTab: 'copilot' | 'inspector' | 'versions' | 'validation' | 'comments',
  bottomDockExpanded: boolean,
  bottomDockTab: 'runs' | 'jobs' | 'logs' | 'notifications'
}

// eventSlice - real-time state
{
  recentEvents: ProjectEvent[],
  activeToasts: Toast[],
  runProgress: Record<string, RunProgress>
}

// draftSlice - unsaved edits
{
  drafts: Record<string, DraftState>,
  dirtyFields: Record<string, string[]>,
  validationErrors: Record<string, ValidationError[]>
}
```

---

## 7. Route Structure

```
/projects
/projects/:projectId                    # Project landing page, does not currently redirect
/projects/:projectId/sources
/projects/:projectId/canon
/projects/:projectId/scenes
/projects/:projectId/shots
/projects/:projectId/workflows
/projects/:projectId/outputs
/projects/:projectId/timeline
/projects/:projectId/review
/projects/:projectId/activity
/projects/:projectId/compare
```

Notes:

- `/projects/:projectId/exports` is not currently routed as a standalone page
- export operations are currently surfaced under outputs/review flows rather than a dedicated route

---

## 8. Dependencies

### Frontend Dependencies (already in package.json)

- React Router
- TanStack Query
- Zustand
- Tailwind CSS

### New Frontend Dependencies

- `react-diff-viewer` or custom for text diff
- `react-player` for video preview

### Backend Dependencies (none needed)

All backend work uses existing Fastify + Drizzle setup.

---

## 9. Testing Strategy

### M5 Testing

- Shell renders correctly with all panels
- Sidebar collapse/expand works
- Panel state persists across navigation

### M6 Testing

- Create shot → edit prompt → save → new version created
- Generate preview → image appears in preview panel
- Version history shows all versions

### M7 Testing

- Workflow run appears in activity page
- Node logs expandable
- Retry workflow creates new run

### M8 Testing

- Video player plays output
- Timeline shows clips
- Export triggers job

### M9 Testing

- Compare two asset versions shows diff
- Media compare shows side-by-side

---

## 10. Open Questions

1. Should copilot be real AI chat or action suggestions only?
2. How much of timeline should be editable in v1?
3. Should diff be inline or modal?
4. Should user mode preference persist per project or globally?
5. When should media preview thumbnails be generated?

---

## 11. Definition of Done for v2

- [ ] Shell layout complete (sidebar, right panel, bottom dock)
- [ ] Shell panels are connected to real project data rather than mocks/placeholders
- [ ] Shots page functional per spec
- [ ] Activity page shows all runs and jobs
- [ ] Timeline page plays preview output
- [ ] Diff/compare works for assets
- [ ] User modes switch UI density
- [ ] Review UI performs real asset approval/rejection state transitions
- [ ] Frontend API calls are consistent and use the shared API base/client
- [ ] Asset links created automatically on generation
- [ ] Basic E2E test passes for full workflow

---

## 12. Files to Create/Modify

### Existing Files To Complete or Replace Mock Logic In

```
frontend/src/
├── stores/
│   ├── index.ts
│   ├── appStore.ts
│   ├── selectionStore.ts
│   ├── panelStore.ts
│   └── eventStore.ts
├── components/
│   └── shell/
│       ├── AppShell.tsx
│       ├── ProjectSidebar.tsx
│       ├── TopToolbar.tsx
│       ├── RightContextPanel.tsx
│       ├── BottomActivityDock.tsx
│       ├── CopilotPanel.tsx
│       ├── InspectorPanel.tsx
│       ├── VersionsPanel.tsx
│       ├── ValidationPanel.tsx
│       └── CommentsPanel.tsx
├── pages/
│   ├── ShotsPage/
│   ├── TimelinePage/
│   ├── ActivityPage/
│   ├── ReviewTab.tsx
│   └── OutputsTab.tsx
└── components/diff/
    ├── DiffViewer.tsx
    ├── TextDiff.tsx
    └── MediaCompare.tsx

backend/src/
├── routes/
│   ├── links.ts
│   ├── reviews.ts
│   └── assets.ts
└── runtime/
    └── execution-engine.ts

database/src/
├── bootstrap.ts
├── schema.ts
├── links.ts
├── reviews.ts
└── assets.ts
```

### Additional Files Likely Needed

```
backend/src/services/
└── generation-logger.ts      # only if generation/service-call persistence is added as a dedicated module

database/src/
└── validation-results.ts     # only if validation result persistence is implemented as a dedicated module
```

---

## 13. Effort Estimate

| Milestone                | Days | Priority |
| ------------------------ | ---- | -------- |
| M5: Shell Architecture   | 2    | P0       |
| M6: Shots Page           | 3    | P0       |
| M7: Activity Page        | 2    | P1       |
| M8: Timeline Page        | 2    | P1       |
| M9: Diff & Compare       | 1    | P2       |
| M10: User Modes & Polish | 1    | P2       |
| M11: Backend Completions | 1    | P3       |

**Total: ~12 days (2-3 weeks)**
