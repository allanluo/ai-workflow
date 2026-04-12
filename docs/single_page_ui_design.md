# Single Page UI Design Document v1

## 1. Overview

This document defines the complete UI design for the story-to-media production desktop application. The design follows a unified shell architecture where all pages share the same layout structure.

---

## 2. Layout Structure

### 2.1 Overall Layout

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              Menu Bar (48px)                                    │
│  [Logo]  File  Edit  View  Project  Help                    [🔍 Search] [👤] │
├─────────┬───────────────────────────────────────────────────────┬──────────────┤
│         │              Top Toolbar (48px)                       │              │
│         │  Project: My Film  >  Shots   [Create] [Run] [Export]│              │
│ Sidebar ├───────────────────────────────────────────────────────┤   Context   │
│  240px  │                                                       │    Panel    │
│         │                                                       │    320px    │
│ Project │                  Main Canvas                         │              │
│  Tree   │                  (flex-1)                            │  [Inspector]│
│         │                                                       │  [Versions] │
│         │                  Page Content                         │  [Validation]│
│         │                                                       │  [Comments] │
│         │                                                       │  [Copilot]  │
│         │                                                       │              │
├─────────┴───────────────────────────────────────────────────────┴──────────────┤
│                         Bottom Activity Dock (48-240px)                         │
│  [Runs] [Jobs] [Logs] [Notifications]                              ▶  ████░░░  │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Layout Specifications

| Component     | Width           | Height                          | Collapsible        |
| ------------- | --------------- | ------------------------------- | ------------------ |
| Menu Bar      | 100%            | 48px                            | No                 |
| Sidebar       | 240px → 64px    | flex-1                          | Yes (to icon rail) |
| Context Panel | 320px (240-480) | flex-1                          | Yes                |
| Top Toolbar   | 100%            | 48px                            | No                 |
| Activity Dock | 100%            | 48px collapsed / 240px expanded | Yes                |

---

## 3. Menu Bar

### 3.1 Structure

```
[Logo]  File    Edit    View    Project    Help          [Search]      [User] [Settings]
```

### 3.2 Menu Items

| Menu        | Items                                                                                      | Shortcut                                       |
| ----------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **File**    | New Project, Open Project, Import Source, Export..., Close Project, Quit                   | Ctrl+N, Ctrl+O, Ctrl+I, Ctrl+E                 |
| **Edit**    | Undo, Redo, Cut, Copy, Paste, Select All                                                   | Ctrl+Z, Ctrl+Y, Ctrl+X, Ctrl+C, Ctrl+V, Ctrl+A |
| **View**    | Toggle Sidebar, Toggle Context Panel, Toggle Activity Dock, Zoom In, Zoom Out, Full Screen | Ctrl+B, Ctrl+J, Ctrl+L                         |
| **Project** | Project Settings, Workflows, Outputs, Runs, Validate All, Approve All                      |                                                |
| **Help**    | Documentation, Keyboard Shortcuts, Check for Updates, About                                | F1                                             |

### 3.3 Right Section

- **Search**: Global search input (Ctrl+K)
- **User**: User avatar/menu
- **Settings**: Gear icon → Preferences

---

## 4. Sidebar

### 4.1 States

**Home State (No Project Open)**

```
┌─────────────────────┐
│ 🔍 Quick Access     │
│ ─────────────────── │
│ Recent Projects    │
│   ▶ My Film        │
│   ▶ Music Video    │
│   ▶ Short Story    │
│                     │
│ ─────────────────── │
│ [Create New]       │
└─────────────────────┘
```

**Project State (Project Open)**

```
┌─────────────────────────┐
│ ▼ Project: My Film      │
│ ─────────────────────── │
│ 📁 Sources              │
│ 📁 Story & Canon        │
│   ├─ Premise           │
│   ├─ Logline           │
│   ├─ Synopsis         │
│   ├─ Characters        │
│   └─ Environments      │
│ 📁 Scenes              │
│ 📁 Shots               │
│ 📁 Workflows           │
│   ├─ Drafts            │
│   ├─ Approved          │
│   └─ Runs              │
│ 📁 Outputs             │
│   ├─ Film              │
│   ├─ Music Video       │
│   └─ Shorts            │
│ 📁 Timeline            │
│ 📁 Review              │
│ 📁 Activity            │
└─────────────────────────┘
```

### 4.2 Interaction

- Click folder to expand/collapse
- Click item to navigate
- Right-click for context menu
- Drag to reorder (in scenes/shots)
- Collapse button at bottom

---

## 5. Top Toolbar

### 5.1 Structure

```
[Breadcrumb]                              [Actions]                    [Mode▼]
Project: My Film > Shots                  [Create] [Run] [Export]       Guided ▼
```

### 5.2 Sections

| Section | Content                                     |
| ------- | ------------------------------------------- |
| Left    | Breadcrumb: Project > Section > Resource    |
| Center  | Page-specific actions (Create, Run, Export) |
| Right   | Mode switcher: Simple / Guided / Advanced   |

### 5.3 Action Buttons by Page

| Page      | Primary Actions                           |
| --------- | ----------------------------------------- |
| Sources   | Upload, New Asset                         |
| Canon     | New Asset, Save Version, Approve          |
| Scenes    | Add Scene, Reorder, New Version           |
| Shots     | Regenerate, Validate, Compare             |
| Workflows | Validate, Freeze, Approve, Run, Duplicate |
| Outputs   | Create Version, Approve, Export           |
| Timeline  | Export Preview, Export Final              |
| Review    | Approve, Reject, Comment                  |
| Activity  | Retry, Rerun                              |

---

## 6. Main Canvas

### 6.1 Page Patterns

Each page uses one of these patterns:

**List + Detail**

```
┌────────────────┬─────────────────────────────┐
│                │                             │
│   Item List    │      Detail / Editor       │
│                │                             │
│   [Search]     │                             │
│   [Filter]     │                             │
│                │                             │
│   Item 1 ●     │                             │
│   Item 2       │                             │
│   Item 3       │                             │
└────────────────┴─────────────────────────────┘
```

**Editor**

```
┌─────────────────────────────────────────────┐
│                                             │
│           Rich Text / Form Editor           │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Preview**

```
┌─────────────────────────────────────────────┐
│                                             │
│              Media Preview                  │
│                                             │
│  [◀] [▶] [🔊]          00:00 / 02:30       │
│                                             │
└─────────────────────────────────────────────┘
```

**Graph**

```
┌─────────────────────────────────────────────┐
│                                             │
│           Node Graph / Canvas               │
│                                             │
│    ┌────┐     ┌────┐     ┌────┐            │
│    │Node│────▶│Node│────▶│Node│            │
│    └────┘     └────┘     └────┘            │
│                                             │
└─────────────────────────────────────────────┘
```

### 6.2 Home Page (Special Case)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Menu Bar                                                             │
├─────────┬───────────────────────────────────────────────┬────────────┤
│ Sidebar │  Main Canvas                                             │
│         │                                                            │
│ Quick   │  ┌─────────────────────────────────────────────────────┐  │
│ Access  │  │                                                       │  │
│         │  │  Welcome to AI Workflow Studio                      │  │
│ ─────── │  │                                                       │  │
│ Recent  │  │  [  + New Project  ]    [  Open Project  ]       │  │
│ Projects│  │                                                       │  │
│         │  └─────────────────────────────────────────────────────┘  │
│ • Proj1 │                                                            │
│ • Proj2 │  ┌─────────────────────────────────────────────────────┐  │
│ • Proj3 │  │  Recent Projects                     View All →     │  │
│         │  │  ─────────────────────────────────────────────────── │  │
│         │  │  ▶ My Film Project                                    │  │
│         │  │    Film • Active • Last opened 2h ago                │  │
│         │  │                                                       │  │
│         │  │  ▶ Music Video Draft                                  │  │
│         │  │    Music Video • Draft • Yesterday                  │  │
│         │  └─────────────────────────────────────────────────────┘  │
│         │                                                            │
└─────────┴────────────────────────────────────────────────────────────┘
```

### 6.3 Sources Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Sources                         [+ Upload] [+ New Asset]           │
├──────────────────┬──────────────────────────────────────────────────┤
│ Filter: [All ▼] │  ┌────────────────────────────────────────────┐  │
│ ─────────────── │  │  Preview                                   │  │
│ 📄 story.txt    │  │  ┌──────────────────────────────────────┐  │  │
│ 📄 script.md    │  │  │                                      │  │  │
│ 🎵 music.mp3    │  │  │     [File Content Preview]          │  │  │
│ 🖼️ image.png    │  │  │                                      │  │  │
│ 📄 notes.txt    │  │  └──────────────────────────────────────┘  │  │
│                  │  │                                             │  │
│                  │  │  Details                                   │  │
│                  │  │  ──────────────                            │  │
│                  │  │  Type: Text     Size: 12KB                │  │
│                  │  │  Created: 2026-04-10  Modified: Today     │  │
│                  │  └────────────────────────────────────────────┘  │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 6.4 Shots Page (Critical)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Shots                       [Generate] [Validate] [Compare]       │
├─────────────────┬────────────────────────────────────────────────────┤
│ Filter: [All ▼]│  ┌────────────────────────────────────────────┐   │
│ ─────────────── │  │  Shot Editor                    [Lock] [✓]│   │
│                 │  │  ─────────────────────────────────────────  │   │
│ [T] Shot 1  ✅  │  │                                            │   │
│ [T] Shot 2  🔄  │  │  ┌──────────────────┬─────────────────────┐│   │
│ [T] Shot 3  ❌  │  │  │                  │ Prompt              ││   │
│ [T] Shot 4  ✅  │  │  │   [Preview]      │ ─────────────────── ││   │
│ [T] Shot 5  ⚠️  │  │  │                  │ Close-up of Allan   ││   │
│                 │  │  │    [Image]       │ touching the AK-47 ││   │
│                 │  │  │                  │ magazine...         ││   │
│                 │  │  ├──────────────────┤                    ││   │
│                 │  │  │                  │ Camera             ││   │
│                 │  │  │   [Video]        │ ─────────────────── ││   │
│                 │  │  │                  │ Type: Close-up     ││   │
│                 │  │  │                  │ Angle: Low side    ││   │
│                 │  │  └──────────────────┴─────────────────────┘│   │
│                 │  └────────────────────────────────────────────┘   │
└─────────────────┴────────────────────────────────────────────────────┘
```

### 6.5 Workflows Page

```
┌─────────────────────────────────────────────────────────────────────┐
│ Workflows: Film Workflow ▼ v12        [Validate] [Freeze] [Run]   │
├─────────────────────────────────────────────────────────────────────┤
│ Mode: [Simple] [Guided] [Advanced]                                 │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Stage 1        │──▶│ Stage 2       │──▶│ Stage 3       │         │
│  │                │  │                │  │                │         │
│  │ Parse Story    │  │ Generate Scenes│  │ Generate Shots│         │
│  │                │  │                │  │                │         │
│  │  ✓ Complete   │  │  ◐ Running     │  │  ○ Pending    │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
│                                                                     │
│                              │                                      │
│                              ▼                                      │
│                     ┌────────────────┐                              │
│                     │ Stage 4       │                              │
│                     │                │                              │
│                     │ Render Preview│                              │
│                     │                │                              │
│                     │  ○ Pending    │                              │
│                     └────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Context Panel

### 7.1 Tabs

```
┌─────────────────────────────────────┐
│ [Inspector] [Versions] [Validation]│
│ [Comments] [Copilot]                │
├─────────────────────────────────────┤
│                                     │
│         Tab Content                 │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 7.2 Tab Contents

| Tab        | Content                                              |
| ---------- | ---------------------------------------------------- |
| Inspector  | Metadata, provenance, file properties, workflow info |
| Versions   | Version history, compare, current version selector   |
| Validation | Warnings, pass/fail status, validation results       |
| Comments   | Review comments, approval history                    |
| Copilot    | AI chat, suggestions, workflow help                  |

### 7.3 Default Tab by Page

| Page      | Default Tab |
| --------- | ----------- |
| Sources   | Inspector   |
| Canon     | Versions    |
| Scenes    | Inspector   |
| Shots     | Validation  |
| Workflows | Copilot     |
| Outputs   | Inspector   |
| Timeline  | Comments    |
| Review    | Approvals   |
| Activity  | Inspector   |

---

## 8. Bottom Activity Dock

### 8.1 Collapsed State

```
[Runs] [Jobs] [Logs] [Notifications]                         ▶  [Progress: ████░░░ 45%]
```

### 8.2 Expanded State

```
[Runs] [Jobs] [Logs] [Notifications]
────────────────────────────────────────────────────────────────────────
│ Run ID        │ Status    │ Progress │ Started   │ Actions          │
│ wf_run_001    │ ● Running │ ████░░░░ │ 10:30 AM  │ [Stop] [Logs]    │
│ wf_run_002    │ ✓ Complete│ ████████ │ 10:15 AM  │ [View] [Rerun]   │
│ node_run_003  │ ◐ Running │ ██░░░░░░ │ 10:32 AM  │ [Logs]           │
└────────────────────────────────────────────────────────────────────────
```

---

## 9. Modals & Dialogs

### 9.1 Create Project Modal

```
┌─────────────────────────────────────────────────┐
│ Create New Project                        [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Project Name                                    │
│ [_________________________________________]     │
│                                                 │
│ Description                                     │
│ [_________________________________________]     │
│ [_________________________________________]     │
│                                                 │
│ Output Type                                     │
│ [Film ▼]                                        │
│                                                 │
│              [Cancel]  [Create Project]          │
└─────────────────────────────────────────────────┘
```

### 9.2 Confirm Dialog

```
┌─────────────────────────────────────────────────┐
│ Confirm Action                            [×]   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Are you sure you want to approve this workflow?│
│                                                 │
│ This will freeze version 12 of "Film Workflow" │
│                                                 │
│              [Cancel]  [Approve]                │
└─────────────────────────────────────────────────┘
```

---

## 10. Status Indicators

### 10.1 Status Badges

| Status    | Color  | Icon |
| --------- | ------ | ---- |
| Draft     | Gray   | ○    |
| Pending   | Yellow | ◐    |
| Running   | Blue   | ◐    |
| Approved  | Green  | ✓    |
| Completed | Green  | ✓    |
| Failed    | Red    | ✗    |
| Warning   | Orange | ⚠️   |
| Locked    | Purple | 🔒   |

### 10.2 Trust Badges

| Badge              | Meaning                         |
| ------------------ | ------------------------------- |
| Approved Workflow  | Workflow approved for execution |
| Frozen             | Version locked, immutable       |
| Deterministic      | Fixed seeds, reproducible       |
| Validation Warning | Has validation issues           |
| Output Ready       | Ready for export                |

---

## 11. Color Palette

### 11.1 Semantic Colors

| Role       | Color               | Usage                         |
| ---------- | ------------------- | ----------------------------- |
| Primary    | #3B82F6 (Blue)      | Buttons, links, active states |
| Secondary  | #64748B (Slate)     | Secondary actions, borders    |
| Success    | #22C55E (Green)     | Approved, completed, pass     |
| Warning    | #F59E0B (Amber)     | Warnings, in-progress         |
| Error      | #EF4444 (Red)       | Failed, errors, destructive   |
| Background | #F8FAFC (Light)     | Main canvas                   |
| Surface    | #FFFFFF (White)     | Cards, panels                 |
| Border     | #E2E8F0 (Slate-200) | Dividers, outlines            |

### 11.2 Typography

| Element        | Font           | Size | Weight |
| -------------- | -------------- | ---- | ------ |
| Page Title     | Inter          | 24px | 600    |
| Section Header | Inter          | 18px | 600    |
| Body           | Inter          | 14px | 400    |
| Caption        | Inter          | 12px | 400    |
| Button         | Inter          | 14px | 500    |
| Code           | JetBrains Mono | 13px | 400    |

---

## 12. Spacing System

### 12.1 Base Units

- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px

### 12.2 Component Spacing

| Component | Padding  | Gap  |
| --------- | -------- | ---- |
| Button    | 8px 16px | 8px  |
| Card      | 16px     | 16px |
| Input     | 8px 12px | 8px  |
| List Item | 8px 12px | 4px  |
| Panel     | 16px     | 16px |

---

## 13. Responsive Behavior

### 13.1 Breakpoints

| Breakpoint | Width       | Behavior                   |
| ---------- | ----------- | -------------------------- |
| Compact    | < 1024px    | Sidebar collapses to icons |
| Normal     | 1024-1440px | Full layout                |
| Wide       | > 1440px    | Context panel expands      |

### 13.2 Collapse Order

1. Sidebar collapses to 64px icon rail
2. Context panel collapses to toggle button
3. Activity dock collapses to indicator

---

## 14. Keyboard Shortcuts

### 14.1 Global

| Shortcut | Action               |
| -------- | -------------------- |
| Ctrl+N   | New Project          |
| Ctrl+O   | Open Project         |
| Ctrl+K   | Global Search        |
| Ctrl+,   | Preferences          |
| Ctrl+B   | Toggle Sidebar       |
| Ctrl+J   | Toggle Activity Dock |
| Escape   | Close Modal/Dialog   |

### 14.2 Page-Specific

| Shortcut     | Context  | Action   |
| ------------ | -------- | -------- |
| Ctrl+S       | Editor   | Save     |
| Ctrl+Enter   | Workflow | Run      |
| Ctrl+Shift+V | Any      | Validate |

---

## 15. Component Library

### 15.1 Core Components

| Component | Variants                               | States                                    |
| --------- | -------------------------------------- | ----------------------------------------- |
| Button    | Primary, Secondary, Ghost, Destructive | Default, Hover, Active, Disabled, Loading |
| Input     | Text, Number, Search, Password         | Default, Focus, Error, Disabled           |
| Select    | Single, Multi, Searchable              | Default, Open, Selected, Disabled         |
| Modal     | Standard, Confirm, Full-screen         | Opening, Open, Closing                    |
| Dropdown  | Menu, Select, Context                  | Closed, Open, Item hover                  |
| Tabs      | Horizontal, Vertical, Pills            | Default, Active, Disabled                 |
| Toast     | Info, Success, Warning, Error          | Auto-dismiss, Persistent                  |
| Badge     | Status, Count, Label                   | Default                                   |
| Card      | Default, Selectable, Draggable         | Default, Hover, Selected                  |

### 15.2 Pattern Components

| Component   | Description                      |
| ----------- | -------------------------------- |
| ListPanel   | Filterable list with detail view |
| TreeView    | Expandable tree with icons       |
| Timeline    | Horizontal timeline with markers |
| VideoPlayer | Playback controls with scrubber  |
| CodeEditor  | Syntax-highlighted text editing  |
| NodeGraph   | Draggable nodes with edges       |

---

## 16. File Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── MenuBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ContextPanel.tsx
│   │   ├── ActivityDock.tsx
│   │   └── Shell.tsx
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Tabs.tsx
│   │   ├── Toast.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── patterns/
│   │   ├── ListPanel.tsx
│   │   ├── TreeView.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── NodeGraph.tsx
│   │   └── index.ts
│   └── features/
│       ├── copilot/
│       ├── workflows/
│       ├── shots/
│       └── ...
├── pages/
│   ├── HomePage.tsx
│   ├── ProjectPage.tsx
│   └── ComparePage.tsx
├── hooks/
│   ├── useLayout.ts
│   └── useNavigation.ts
├── stores/
│   ├── layoutStore.ts
│   ├── projectStore.ts
│   └── uiStore.ts
├── types/
│   └── index.ts
└── App.tsx
```

---

## 17. Implementation Priority

### Phase 1: Shell (Week 1-2)

1. MenuBar component
2. Sidebar with project tree
3. ContextPanel with tabs
4. ActivityDock
5. Shell container

### Phase 2: Home Page (Week 2-3)

1. Welcome section
2. Recent projects list
3. Create project modal

### Phase 3: Page Views (Week 3-6)

1. Sources view
2. Canon view
3. Scenes view
4. Shots view (critical)
5. Workflows view
6. Outputs view

### Phase 4: Integration (Week 6-8)

1. Navigation wiring
2. Mode switcher
3. Global search
4. Keyboard shortcuts
5. Persistence

---

## 18. Design Principles Summary

1. **Shell-Based** - All pages share same layout structure
2. **Menu-Driven** - Global actions via top menu bar
3. **Tree Navigation** - Sidebar shows project hierarchy
4. **Context-Aware** - Right panel changes per page
5. **Mode-Switching** - Simple/Guided/Advanced changes density
6. **Status-Visible** - Trust indicators always visible
7. **Keyboard-First** - Power user shortcuts throughout
