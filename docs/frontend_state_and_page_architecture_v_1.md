# Frontend State Model and Page Architecture v1

## 1. Purpose
Define the initial frontend architecture for the story-to-media production system.

This document focuses on:
- frontend state boundaries
- data flow between UI and backend
- page and panel architecture
- view models for core resources
- interaction patterns for versioned creative workflows

The goal is to make the UI implementation coherent before detailed visual design begins.

---

## 2. Design Principles
1. The UI should be project-centric, not tool-centric.
2. Story and media assets are first-class, not hidden inside workflow runs.
3. Workflow visibility should scale by user sophistication.
4. Approved versions must feel frozen and trustworthy.
5. Manual editing and AI-assisted editing should operate on the same underlying state.
6. Long-running generation must always show observable progress.
7. The UI should expose structure before complexity.
8. The main user experience should be story/media-first, not graph-first.

---

## 3. Frontend Architecture Overview
Recommended stack direction:
- Electron shell
- React frontend
- Tailwind UI styling
- Zustand or Redux Toolkit for app state
- React Query for server state and caching
- optional router such as React Router

State should be split into:
- server state
- client UI state
- transient editor state
- session state

---

## 4. State Categories

### 4.1 Server State
Data owned by the backend and fetched by API.

Examples:
- projects
- assets
- asset versions
- asset links
- workflows
- workflow versions
- workflow runs
- node runs
- outputs
- export jobs
- validation results
- comments
- approvals

Recommended handling:
- React Query or equivalent
- normalized by resource type where useful
- invalidated/refetched after mutations

### 4.2 Client UI State
Pure presentation and navigation state.

Examples:
- selected project
- selected page
- selected asset
- open side panels
- active tabs
- tree expansion state
- graph zoom level
- compare mode toggles

Recommended handling:
- Zustand or Redux slice
- persisted selectively across sessions if useful

### 4.3 Transient Editor State
Draft editing state not yet saved to backend.

Examples:
- unsaved story edits
- unsaved workflow node edits
- form fields in dialogs
- local prompt edits before commit

Recommended handling:
- local component state or dedicated draft store
- explicit dirty state tracking

### 4.4 Session State
Session-scoped runtime state.

Examples:
- current user mode (simple/guided/advanced)
- websocket connection status
- currently streaming logs
- toast queue
- active modals
- pending confirmations

---

## 5. Core Frontend Domains
Recommended top-level domains in frontend code:
- app shell
- project browser
- source workspace
- canon workspace
- scene and shot workspace
- workflow workspace
- output workspace
- review and diff workspace
- timeline and preview workspace
- shared media/components

This maps better to the product than purely technical module boundaries.

---

## 6. High-Level Navigation Model
The app should be centered around a selected project.

Recommended global flow:
1. Project Home
2. Source and Story
3. Canon
4. Scenes and Shots
5. Workflow
6. Outputs
7. Review
8. Timeline / Preview / Export

This flow can be presented in sidebar navigation or top-level workspace tabs.

---

## 7. Primary Layout Model
Recommended desktop layout:

### Left Panel
Project navigation tree and resource browser.

Examples:
- Project Home
- Sources
- Story
- Canon
- Scenes
- Shots
- Workflows
- Outputs
- Timeline
- Review
- Exports

### Center Panel
Primary working surface.

Examples:
- editor
- list/detail view
- preview
- graph view
- timeline

### Right Panel
Contextual assistant and inspection tools.

Examples:
- copilot chat
- version history
- validation warnings
- diffs
- approvals
- node/job status

This layout is a strong default because it matches your product direction and supports both creative and operational work.

---

## 8. Page Architecture v1

### 8.1 Project Home Page
Purpose:
- project summary and entry point

Shows:
- title and description
- primary output type
- recent activity
- latest workflow run status
- pending approvals
- recent previews or exports
- quick actions

Useful quick actions:
- add source
- create workflow
- run approved workflow
- open latest output

---

### 8.2 Sources Page
Purpose:
- manage original user materials

Shows:
- uploaded files
- source assets
- source text preview
- import status
- source-to-canon links

Common actions:
- upload source file
- create source asset manually
- mark source as approved input
- convert/import into canon workflow

---

### 8.3 Story and Canon Page
Purpose:
- view and edit normalized creative truth

Sections may include:
- premise
- logline
- synopsis
- beat sheet
- character bible
- environment bible
- style bible
- continuity rules

Views:
- card/list view for canon assets
- detail editor for selected canon asset
- version history for selected canon asset

Common actions:
- edit canon asset
- create new asset version
- approve canon version
- lock fields
- inspect downstream impact

---

### 8.4 Scenes Page
Purpose:
- organize and edit scenes as narrative units

Shows:
- scene cards or table
- scene purpose/conflict/emotional change
- linked shot count
- validation state
- approval state

Common actions:
- reorder scenes
- open scene detail
- create scene version
- inspect linked shots
- regenerate downstream content intentionally

---

### 8.5 Shots Page
Purpose:
- detailed visual/media planning and generation control

Shows for selected shot:
- shot metadata
- prompt and negative prompt
- camera settings
- continuity refs
- latest preview image/video
- validation warnings
- related workflow/version provenance

Common actions:
- edit shot fields
- create new shot version
- regenerate preview
- run continuity validation
- compare versions
- lock fields like face/wardrobe/environment

This is one of the most important workspaces in the product.

---

### 8.6 Workflow Page
Purpose:
- inspect, edit, approve, and run workflows

Recommended modes:
- simple view
- guided workflow view
- advanced graph view

#### Simple View
Shows only stages:
- sources -> canon -> scenes -> shots -> preview -> output

#### Guided View
Shows workflow steps in ordered stage blocks with editable config.

#### Advanced View
Shows node graph for power users.

Common actions:
- create workflow draft
- validate workflow
- freeze workflow version
- approve workflow version
- duplicate workflow version into new draft
- run workflow
- inspect node statuses

---

### 8.7 Outputs Page
Purpose:
- manage output families and output versions

Shows:
- film outputs
- MV outputs
- short-form outputs
- audio outputs
- output settings
- linked workflow version
- approval status
- linked export jobs

Common actions:
- create output family
- create output version from workflow run
- approve output version
- duplicate output version
- inspect manifest

---

### 8.8 Timeline / Preview Page
Purpose:
- review assembled media and timeline structure

Shows:
- timeline segments
- clip order
- clip durations
- voice/music/caption layers
- preview player
- export actions

Common actions:
- preview cut
- replace selected clip with another version
- toggle captions/music/narration
- request export preview
- request final export

The v1 timeline can be lightweight. It does not need to be a full NLE initially.

---

### 8.9 Review and Diff Page
Purpose:
- compare versions, inspect changes, and manage approvals

Shows:
- before/after content diffs
- side-by-side media compare
- validation warnings
- unresolved review comments
- pending approvals

Common actions:
- approve/reject
- comment
- compare versions
- inspect what changed due to rerun or propagation

---

### 8.10 Jobs and Activity Page
Purpose:
- monitor execution and debug generation

Shows:
- workflow runs
- node runs
- export jobs
- queue state
- recent failures
- logs and warnings

This can be a separate page or dockable developer/operator panel.

---

## 9. Shared View Models
The frontend should derive stable view models from backend resources.

Recommended view models:
- `ProjectSummaryVM`
- `AssetListItemVM`
- `AssetDetailVM`
- `SceneCardVM`
- `ShotInspectorVM`
- `WorkflowSummaryVM`
- `WorkflowGraphVM`
- `OutputCardVM`
- `TimelineVM`
- `ReviewItemVM`
- `JobStatusVM`

This helps decouple API payloads from UI rendering needs.

---

## 10. Selection Model
The UI needs a consistent selection model.

Recommended selected objects:
- selectedProjectId
- selectedPage
- selectedAssetId
- selectedAssetVersionId
- selectedWorkflowId
- selectedWorkflowVersionId
- selectedWorkflowRunId
- selectedOutputId
- selectedOutputVersionId
- selectedJobId

Only one primary selection should drive the center panel at a time.
Secondary related selections can live in side panels.

---

## 11. Draft Editing Model
Important distinction:
- viewing an immutable version
- editing toward a new version

Recommended UX behavior:
- opening an immutable version shows read-only state
- clicking edit creates a local draft copy
- saving creates a new backend version
- user can discard local draft

Frontend draft state should track:
- base version id
- current draft values
- dirty fields
- validation errors
- lock conflicts

---

## 12. Diff and Compare Model
Comparison should be first-class.

Supported comparison types in v1:
- text diff for canon/story assets
- structured field diff for scenes/shots/workflows
- side-by-side media compare for images/video
- workflow version diff for nodes/settings

The compare model should always show:
- baseline version
- candidate version
- changed fields
- who/what created the candidate version

---

## 13. Progress and Event Model
The UI must subscribe to workflow/job events and reflect them clearly.

Recommended event domains:
- workflow events
- node events
- export events
- validation events
- asset creation events

Frontend behavior:
- show toasts for important transitions
- update run status panels in near real time
- update affected lists/cards when new versions appear
- surface warnings without forcing full-page refreshes

---

## 14. Caching Strategy
Recommended approach:
- React Query for server resources
- cache by resource id and list filters
- invalidate precise queries after mutations
- keep current project resources warm when user navigates between pages

Examples:
- invalidate `assets(projectId, assetType=scene)` after scene version creation
- invalidate `workflow-runs(workflowVersionId)` after run trigger
- invalidate `output-versions(outputId)` after export creation if output manifest changes

---

## 15. Optimistic vs Pessimistic Updates
Suggested policy:

### Optimistic updates allowed for:
- panel open/close
- local draft edits
- simple metadata edits with low risk

### Pessimistic confirmation preferred for:
- creating new immutable versions
- approving workflows
- running workflows
- exports
- lock/unlock actions

This keeps trust high.

---

## 16. User Modes
The UI should adapt to user sophistication.

### Simple Mode
- hide graph complexity
- show high-level stages
- emphasize copilot and previews

### Guided Mode
- show workflow steps and editable settings
- show version history and review tools

### Advanced Mode
- show node graph
- show execution details
- show adapters/models/settings

This can be a persistent user preference or workspace toggle.

---

## 17. Copilot Integration Model
The copilot should be context-aware.

Contexts:
- project-wide
- current page
- selected asset
- selected workflow
- selected output

Common copilot actions:
- propose workflow draft
- revise asset
- explain validation warning
- generate patch options
- trace drift cause
- suggest rerun scope

Copilot responses should preferably resolve into:
- proposed patches
- workflow draft changes
- comments
- validation explanations
- action buttons

Not just chat text.

---

## 18. Key Components v1
Recommended component inventory:
- `AppShell`
- `ProjectSidebar`
- `ResourceTree`
- `TopToolbar`
- `ContextPanel`
- `CopilotPanel`
- `VersionHistoryPanel`
- `ValidationPanel`
- `AssetList`
- `AssetEditor`
- `SceneCardList`
- `ShotInspector`
- `WorkflowStageEditor`
- `WorkflowGraphView`
- `OutputList`
- `TimelinePanel`
- `MediaPreview`
- `DiffViewer`
- `JobMonitorPanel`
- `ApprovalActionBar`

---

## 19. Recommended Routing Structure
Example route structure:
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/sources`
- `/projects/:projectId/canon`
- `/projects/:projectId/scenes`
- `/projects/:projectId/shots`
- `/projects/:projectId/workflows`
- `/projects/:projectId/outputs`
- `/projects/:projectId/timeline`
- `/projects/:projectId/review`
- `/projects/:projectId/activity`

Optional detail routes:
- `/projects/:projectId/assets/:assetId`
- `/projects/:projectId/workflows/:workflowId`
- `/projects/:projectId/outputs/:outputId`

---

## 20. Recommended State Store Shape
Conceptual store slices:

### appSlice
- currentProjectId
- selectedPage
- userMode
- connectionStatus
- theme

### selectionSlice
- selectedAssetId
- selectedAssetVersionId
- selectedWorkflowId
- selectedWorkflowVersionId
- selectedWorkflowRunId
- selectedOutputId
- selectedOutputVersionId
- selectedJobId

### panelSlice
- leftSidebarOpen
- rightPanelOpen
- copilotOpen
- versionHistoryOpen
- validationPanelOpen
- comparePanelOpen

### draftSlice
- draftByResourceKey
- dirtyFieldsByResourceKey
- draftValidationErrors

### eventSlice
- recentEvents
- activeToasts
- runProgressByWorkflowRunId

Server state should stay in query cache rather than large custom stores unless there is a strong reason otherwise.

---

## 21. Page Loading Strategy
Recommended loading behavior:
- load project shell first
- lazily fetch page-specific resources
- prefetch likely next resources where useful

Examples:
- from scenes page, prefetch shots for selected scene
- from workflows page, prefetch latest workflow runs
- from outputs page, prefetch export jobs for current output

---

## 22. Empty States and Guided Starts
Important for non-expert users.

Examples:
- no source yet -> prompt upload or create from idea
- no workflow yet -> offer copilot-generated workflow template
- no outputs yet -> offer create output from latest approved workflow run
- no preview yet -> explain next required step

Empty states should guide the user forward, not merely say nothing exists.

---

## 23. Error and Conflict Handling
The UI should handle:
- save conflicts
- immutable version edits
- lock conflicts
- failed workflow runs
- validation failures
- missing referenced assets

Recommended UX:
- inline errors for field issues
- persistent alert banners for run-level failures
- explainable error dialogs for failed node or service calls
- explicit conflict dialogs when a user tries to mutate frozen resources

---

## 24. Suggested Frontend Milestones

### Milestone 1
- app shell
- project browser
- sources page
- canon page
- scenes page
- basic workflows page (simple/guided only)
- progress event subscription

### Milestone 2
- shots page with preview inspector
- outputs page
- review and diff page
- approvals/comments panels
- activity/jobs page

### Milestone 3
- timeline/preview page
- advanced workflow graph view
- richer compare tools
- deeper propagation/impact inspection

---

## 25. Non-Goals for v1
- full NLE-quality timeline editor
- graph-first UI as the default experience
- every page supporting every asset type equally well
- real-time multi-user collaborative editing
- fully generic workflow-builder UX across unrelated domains

---

## 26. Open Design Questions
1. Should the center panel use route-driven detail views or split-pane master/detail patterns more heavily?
2. How much of the asset graph should be visible outside the workflow page?
3. Should workflow simple/guided/advanced views live in one page or separate sub-routes?
4. How aggressively should the copilot panel surface action buttons versus plain chat?
5. Which pages should allow inline editing versus dedicated editors?
6. Should the timeline page be output-centric or media-asset-centric in v1?
7. How much persistence should be applied to panel layout and selection state between sessions?
8. Should activity/jobs stay in a separate page or become a global docked panel?

