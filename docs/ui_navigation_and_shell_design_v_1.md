# UI Navigation and Shell Design v1

## 1. Purpose
Define the shell, navigation structure, and global workspace behavior for the story-to-media production system.

This document focuses on:
- overall desktop shell layout
- primary navigation model
- panel responsibilities
- toolbar and global actions
- mode switching between simple, guided, and advanced use
- how users move through projects, assets, workflows, and outputs

This is not yet visual styling. It is the interaction skeleton of the product.

---

## 2. Design Goals
The shell should:
- feel like a creative production workspace, not a generic automation tool
- keep users oriented inside a project at all times
- make story/media work primary and workflow complexity secondary
- scale from beginner use to expert use without changing the core product model
- make long-running operations visible without disrupting editing
- support quick switching between sources, canon, scenes, shots, workflows, outputs, and review

---

## 3. Core UX Positioning
The UI should be:
- **project-first**
- **story/media-first**
- **workflow-aware**
- **review-friendly**
- **progress-visible**

It should not feel like:
- ComfyUI as the default shell
- n8n as the default shell
- a generic AI chat app

The shell should feel closer to a creative workspace with structured AI assistance.

---

## 4. Primary Shell Layout
Recommended default desktop layout:

### Left Sidebar
Persistent project navigation and resource hierarchy.

### Top Toolbar
Project-level actions, mode switching, run/export actions, search, and status.

### Center Workspace
Primary working area for the selected page or asset.

### Right Context Panel
Contextual assistant, version history, validation, approvals, and inspector tools.

### Bottom Activity Dock (optional but recommended)
Run status, jobs, logs, export progress, and notifications.

This layout supports both creative editing and operational control without overwhelming the user.

---

## 5. Left Sidebar Design
The left sidebar should be the primary navigation anchor.

### 5.1 Top Section
- workspace/logo
- project switcher
- create/open project action

### 5.2 Main Navigation Sections
Recommended structure:
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

### 5.3 Optional Tree Substructure
Within selected sections, show expandable subsections.

Examples:
- Story & Canon
  - Premise
  - Logline
  - Synopsis
  - Beat Sheet
  - Characters
  - Environments
  - Style Rules
  - Continuity

- Outputs
  - Film
  - Music Video
  - Shorts
  - Audio Story

- Workflows
  - Drafts
  - Approved Versions
  - Runs

### 5.4 Sidebar Behavior
- collapsible to icon rail
- preserves expansion state per project
- highlights current page and selected item
- supports quick-create actions from section headers

---

## 6. Top Toolbar Design
The top toolbar should be global but project-aware.

### 6.1 Left Area
- current project name
- breadcrumb or current page path
- save state indicator for active draft view

### 6.2 Center Area
- global search
- jump-to resource input

Suggested search targets:
- assets
- workflows
- outputs
- jobs
- comments

### 6.3 Right Area
High-value project actions:
- user mode switcher: Simple / Guided / Advanced
- create action menu
- run workflow button
- export button
- notifications / alerts
- settings

### 6.4 Toolbar Behavior
Toolbar actions should adapt to context.

Examples:
- on Workflow page: primary action = Validate / Run / Approve Workflow
- on Output page: primary action = Create Output Version / Export Preview
- on Shot page: primary action = Regenerate / Compare / Validate

---

## 7. Center Workspace Design
The center workspace is the main editing and review surface.

Recommended patterns:

### 7.1 List + Detail Pattern
Best for:
- assets
- scenes
- outputs
- workflows

Left or top area shows list/cards.
Main detail area shows selected object editor.

### 7.2 Editor Pattern
Best for:
- story text
- canon assets
- shot prompt editing
- workflow stage editing

### 7.3 Graph Pattern
Best for:
- advanced workflow editing
- dependency inspection

### 7.4 Preview Pattern
Best for:
- media preview
- timeline preview
- before/after compare

The shell should allow different center patterns per page without changing the global frame.

---

## 8. Right Context Panel Design
The right panel should be contextual, not overloaded by default.

Recommended tabs:
- Copilot
- Inspector
- Versions
- Validation
- Approvals
- Comments

### 8.1 Copilot Tab
Shows:
- contextual chat
- suggested actions
- patch proposals
- rerun or workflow suggestions

### 8.2 Inspector Tab
Shows:
- metadata
- provenance
- linked resources
- workflow version/run info
- file/media properties

### 8.3 Versions Tab
Shows:
- version history
- compare entry points
- current version state
- frozen/approved status

### 8.4 Validation Tab
Shows:
- warnings
- pass/fail status
- detailed validation results

### 8.5 Approvals / Comments Tab
Shows:
- approval history
- comment thread
- unresolved review items

### 8.6 Right Panel Behavior
- collapsible
- default tab depends on context
- can auto-open on warnings or review-required states
- width should be resizable

---

## 9. Bottom Activity Dock
Recommended as a persistent but collapsible strip or drawer.

Shows:
- active workflow runs
- active node jobs
- export progress
- recent warnings/errors
- event feed

Why it matters:
- long-running generation is core to the product
- users should not lose visibility when navigating away

Suggested tabs:
- Runs
- Jobs
- Logs
- Notifications

This can be lightweight in v1 but should exist.

---

## 10. Navigation Model by User Mode

### 10.1 Simple Mode
Goal:
- minimize technical complexity

Navigation behavior:
- hide advanced workflow graph entry points
- show workflow as stages, not nodes
- emphasize Sources, Story, Scenes, Shots, Outputs, Preview
- keep Activity more backgrounded

### 10.2 Guided Mode
Goal:
- expose workflow structure without graph overload

Navigation behavior:
- show Workflows page with editable step blocks
- show validation, versions, and review more visibly
- allow output-specific configuration

### 10.3 Advanced Mode
Goal:
- give power users direct control

Navigation behavior:
- expose graph editing mode
- expose deeper run/node details
- expose adapter/model settings in inspector
- expose richer activity/debug tools

Mode should change information density, not the underlying product model.

---

## 11. Page-by-Page Shell Behavior

### 11.1 Home
Center:
- project dashboard
Right panel default:
- Copilot or recent activity
Top action:
- Add Source or Create Workflow

### 11.2 Sources
Center:
- file list + preview/detail
Right panel default:
- Inspector
Top action:
- Upload Source

### 11.3 Story & Canon
Center:
- canon asset list + editor
Right panel default:
- Versions or Validation
Top action:
- New Canon Asset / Save New Version

### 11.4 Scenes
Center:
- scene cards/table + detail
Right panel default:
- Inspector or Validation
Top action:
- Add Scene / Regenerate from Canon

### 11.5 Shots
Center:
- shot list + shot inspector + media preview
Right panel default:
- Validation or Versions
Top action:
- Regenerate Shot / Validate

### 11.6 Workflows
Center:
- simple, guided, or advanced workflow view
Right panel default:
- Versions or Copilot
Top action:
- Validate / Freeze / Run Workflow

### 11.7 Outputs
Center:
- output list + output detail
Right panel default:
- Inspector or Approval
Top action:
- Create Output Version / Export

### 11.8 Timeline & Preview
Center:
- timeline + player
Right panel default:
- Inspector or Comments
Top action:
- Export Preview / Final Export

### 11.9 Review
Center:
- diff/compare and pending decisions
Right panel default:
- Approvals
Top action:
- Approve / Reject / Comment

### 11.10 Activity
Center:
- workflow runs / node runs / logs
Right panel default:
- Inspector
Top action:
- Retry / Rerun / Open Related Resource

---

## 12. Breadcrumb and Orientation Model
The shell should always show where the user is.

Recommended breadcrumb pattern:
- Project / Section / Resource / Version

Examples:
- Rise Up Canada / Shots / Shot 12 / v4
- Allan Survival Film / Workflows / Film Preview Workflow / v12

This is especially important because versioning is central to the product.

---

## 13. Global Create Menu
A global create menu in the toolbar is recommended.

Suggested create actions:
- New Project
- Upload Source
- New Source Asset
- New Canon Asset
- New Scene
- New Shot
- New Workflow Draft
- New Output
- New Comment

The available options can be context-aware.

---

## 14. Global Search and Jump Model
Search should support both discovery and navigation.

Suggested results types:
- project
- asset family
- asset version
- workflow definition
- workflow version
- output
- job/run
- comment

Useful quick actions from search results:
- open resource
- open latest version
- compare versions
- open related output/workflow

---

## 15. Context Action Bars
Pages should use a local action bar under the toolbar or within the center panel.

Examples:
- Scenes page: Reorder, New Version, Approve, Impact Analysis
- Shots page: Regenerate, Lock Fields, Compare, Validate
- Workflows page: Validate, Freeze, Approve, Run, Duplicate
- Outputs page: Create Version, Approve, Export

This avoids stuffing too many controls into the global toolbar.

---

## 16. Recommended Shell Patterns for Key Pages

### 16.1 Story & Canon
Pattern:
- left local list of canon items
- main editor
- right versions/validation/copilot

### 16.2 Shots
Pattern:
- left shot list
- main shot editor and preview stack
- right validation and version controls

### 16.3 Workflows
Pattern:
- top workflow selector/version selector
- center stage editor or graph editor
- right versions/copilot/inspector
- bottom activity dock for run status

### 16.4 Timeline & Preview
Pattern:
- top output selector
- center player + timeline
- right comments/inspector
- bottom activity dock for render status

---

## 17. Modal and Drawer Strategy
Use modals sparingly for:
- create resource
- confirm approve/freeze
- lock/unlock fields
- export settings
- rerun scope selection

Use drawers or side panels for:
- version history
- compare view
- comments
- validation details

Do not trap major editing flows inside modal-heavy UX.

---

## 18. Warning and Trust Signals
Because the product centers on frozen contracts and reproducibility, the shell should make trust state visible.

Recommended visual state indicators:
- Draft
- Approved
- Locked
- Needs Revision
- Failed
- Running
- Completed
- Warning

These states should appear consistently in:
- lists
- cards
- headers
- version selectors
- job monitors

Important trust badges:
- Approved Workflow Version
- Frozen
- Deterministic Mode
- Validation Warning
- Output Ready

---

## 19. Responsive Behavior
Primary target is desktop.

Recommended fallback behavior for smaller widths:
- collapse left sidebar into icon rail
- collapse right panel into toggle drawer
- bottom activity dock becomes tabbed drawer

Do not optimize for mobile in v1.

---

## 20. Persistence Behavior
Shell should remember per-user or per-project preferences such as:
- sidebar collapsed state
- right panel open state
- selected right-panel tab
- last selected user mode
- last selected workflow/output within a project
- panel sizes

This makes the workspace feel stable.

---

## 21. Suggested Initial Navigation Hierarchy
Recommended final v1 navigation order:
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

This order reflects the natural creative-production flow while still supporting operations and review.

---

## 22. Suggested Initial Shell Milestone
For the first working shell, include:
- left sidebar
- top toolbar
- center page router
- right context panel with tabbed content
- lightweight bottom activity dock
- global create menu
- mode switcher
- breadcrumbs

This is enough to support real implementation without overcommitting to final visuals.

---

## 23. Non-Goals for v1
- graph-first main shell
- floating-window heavy professional NLE shell
- hyper-customizable panel docking system
- mobile-first layout
- generic workflow builder shell across unrelated domains

---

## 24. Open Design Questions
1. Should Review and Activity be full pages, global drawers, or both?
2. Should Exports remain a separate nav item or live under Outputs/Timeline?
3. Should Story & Canon be one page or split into two entries in the sidebar?
4. How much should mode switching alter navigation labels and density?
5. Should the right panel be global across pages or partially page-specific in implementation?
6. Should the bottom activity dock be always visible or auto-expand only when jobs are active?
7. Should workflow version selectors live in the top toolbar, page header, or right panel?
8. Which page should become the true "default workspace" after Home for most users?

