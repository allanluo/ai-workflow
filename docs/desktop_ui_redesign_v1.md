# Desktop UI Redesign v1

## 1. Current Issues

### Problems Identified

1. **Home page confusion** - "Create New Project" and "Recent Projects" are displayed as two equal cards, but they serve different purposes
2. **Navigation not unified** - No top menu bar, navigation scattered
3. **Level mismatch** - Global actions mixed with local page actions
4. **Missing hierarchy** - No clear separation between app-level, project-level, and page-level elements
5. **Layout inconsistent** - Some pages use ProjectLayout, some use AppShell inconsistently

---

## 2. Redesign Principles

### 2.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Menu Bar (64px)                               │
│  [Logo] File  Edit  View  Project  Help          [Search] [User] [⚙️]  │
├──────────┬────────────────────────────────────────────┬──────────────┤
│          │                                            │              │
│  Sidebar │              Main Canvas                   │   Context    │
│  (240px) │              (flex-1)                      │   Panel      │
│          │                                            │   (320px)    │
│  Project │                                            │              │
│  Tree    │                                            │  [Inspector] │
│          │                                            │  [Versions]  │
│          │                                            │  [Validation]│
│          │                                            │  [Comments]  │
│          │                                            │  [Copilot]   │
├──────────┴────────────────────────────────────────────┴──────────────┤
│                        Bottom Activity Dock (optional)                 │
│  [Jobs] [Runs] [Logs]                              Progress: ████░░░  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Menu Bar Structure

Top menu bar replaces the current header and provides unified access to:

| Menu        | Items                                                                                |
| ----------- | ------------------------------------------------------------------------------------ |
| **File**    | New Project, Open Project, Import Source, Export..., Preferences, Quit               |
| **Edit**    | Undo, Redo, Cut, Copy, Paste, Select All                                             |
| **View**    | Toggle Sidebar, Toggle Context Panel, Toggle Activity Dock, Zoom In/Out, Full Screen |
| **Project** | Project Settings, Workflows, Outputs, Runs, Validate All, Approve All                |
| **Help**    | Documentation, Keyboard Shortcuts, About                                             |

### 2.3 Sidebar Structure

```
┌────────────────────────────┐
│ ▼ Project: [Name]           │
│   ─────────────────────    │
│   📁 Sources               │
│   📁 Story & Canon          │
│     ├─ Premise             │
│     ├─ Logline             │
│     ├─ Synopsis            │
│     ├─ Characters          │
│     └─ Environments        │
│   📁 Scenes                │
│   📁 Shots                 │
│   📁 Workflows             │
│     ├─ Drafts              │
│     ├─ Approved            │
│     └─ Runs                │
│   📁 Outputs               │
│     ├─ Film               │
│     ├─ Music Video         │
│     └─ Shorts             │
│   📁 Timeline              │
│   📁 Review                │
│   📁 Activity              │
└────────────────────────────┘
```

### 2.4 Context Panel Tabs

| Tab        | Content                               |
| ---------- | ------------------------------------- |
| Inspector  | Metadata, provenance, file properties |
| Versions   | Version history, compare              |
| Validation | Warnings, pass/fail status            |
| Comments   | Review comments, approval             |
| Copilot    | AI assistant chat                     |

---

## 3. Home Page Redesign

### 3.1 Current Problem

The current home page splits "Create New Project" and "Recent Projects" into two equal cards, making it unclear what the primary action is.

### 3.2 New Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Menu Bar                                                                │
├──────────┬────────────────────────────────────────────┬──────────────┤
│ Sidebar  │  Main Canvas                                        │ Context     │
│          │                                                      │ Panel       │
│ [None]   │  ┌─────────────────────────────────────────────┐  │             │
│          │  │  Welcome to AI Workflow Studio               │  │ [Copilot]   │
│ ───────  │  │                                             │  │             │
│          │  │  [Create New Project]  [Open Project]      │  │ Get help    │
│ Quick    │  │                                             │  │ with your   │
│ Access   │  └─────────────────────────────────────────────┘  │ workflow   │
│          │                                                      │             │
│ ───────  │  ┌─────────────────────────────────────────────┐  │             │
│ Recent   │  │  Recent Projects                             │  │             │
│ Projects │  │  ───────────────────────────────             │  │             │
│          │  │  ▶ My Film Project           [Open]         │  │             │
│ • Proj 1 │  │    Last opened: 2 hours ago                  │  │             │
│ • Proj 2 │  │    Output: Film    Status: Active            │  │             │
│ • Proj 3 │  │                                             │  │             │
│          │  │  ▶ Music Video Draft        [Open]          │  │             │
│          │  │    Last opened: Yesterday                    │  │             │
│          │  │    Output: Music Video  Status: Draft        │  │             │
│          │  └─────────────────────────────────────────────┘  │             │
└──────────┴────────────────────────────────────────────────────┴────────────┘
```

### 3.3 Key Changes

1. **Welcome Section** - Prominent "Create New Project" and "Open Project" buttons at top
2. **Single Column Layout** - Recent projects listed vertically, not side-by-side with creation form
3. **Quick Access Sidebar** - Recent projects in sidebar for quick navigation
4. **Context Panel** - Copilot help available even on home page

---

## 4. Project Detail Page Redesign

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Menu Bar                                                                │
├──────────┬────────────────────────────────────────────┬──────────────┤
│ Sidebar  │  Top Toolbar: [Project Name] > [Page]     │ Context     │
│          │  [Create] [Run] [Export] [Mode▼]         │ Panel       │
│ 📁 Proj  │──────────────────────────────────────────│             │
│   Sources│                                            │ [Inspector] │
│   Canon │        Main Canvas                          │ [Versions]  │
│   Scenes│        (Page-specific content)              │ [Validation]│
│   Shots │                                            │ [Comments]  │
│   Work- │                                            │ [Copilot]   │
│    flows│                                            │             │
│   Out-  │                                            │             │
│    puts │                                            │             │
└──────────┴────────────────────────────────────────────┴──────────────┘
```

### 4.2 Page Patterns

#### Sources Page

```
┌─────────────────────────────────────────────────────────────┐
│ Sources                       [+ Upload] [+ New Asset]       │
├──────────────────┬──────────────────────────────────────────┤
│ File List        │ Preview / Details                        │
│ ─────────────    │ ┌──────────────────────────────────────┐  │
│ 📄 story.txt     │ │ [File Preview]                       │  │
│ 📄 script.md     │ │                                      │  │
│ 🎵 music.mp3     │ └──────────────────────────────────────┘  │
│ 🖼️ image.png    │ Metadata:                                │
│                  │ - Type: text/plain                       │
│                  │ - Size: 12KB                             │
│                  │ - Added: 2026-04-10                     │
└──────────────────┴──────────────────────────────────────────┘
```

#### Shots Page (Critical)

```
┌─────────────────────────────────────────────────────────────┐
│ Shots                         [Generate] [Validate] [Compare]│
├──────────────────┬──────────────────────────────────────────┤
│ Shot List        │ Shot Editor + Preview                   │
│ ─────────────    │ ┌─────────────┬────────────────────────┐│
│ [T] Shot 1  ✅   │ │ [Preview]   │ Prompt                  ││
│ [T] Shot 2  🔄   │ │             │ ─────────────────────── ││
│ [T] Shot 3  ❌   │ │ [img]       │ Close-up of Allan...    ││
│ [T] Shot 4  ✅   │ │             │                        ││
│                  │ ├─────────────┤ Camera                 ││
│                  │ │ [Video]     │ - Type: Close-up        ││
│                  │ │             │ - Angle: Low side       ││
│                  │ └─────────────┴────────────────────────┘│
└──────────────────┴──────────────────────────────────────────┘
```

---

## 5. Navigation Flow

### 5.1 Entry Points

1. **No Project Open** → Home Page
   - Create new project
   - Open existing project

2. **Project Open** → Project Workspace
   - Navigate via sidebar
   - Access via menu bar

### 5.2 Sidebar Behavior

- **Home State**: Sidebar shows "Quick Access" with recent projects
- **Project State**: Sidebar shows project tree with sections
- **Collapsible**: Can collapse to icon rail (48px)

### 5.3 Mode Switcher

Located in top toolbar (right side):

| Mode     | Behavior                            |
| -------- | ----------------------------------- |
| Simple   | Hide workflow graph, show stages    |
| Guided   | Show step blocks, expose validation |
| Advanced | Show full graph editor, debug tools |

---

## 6. Component Specifications

### 6.1 Menu Bar

```tsx
interface MenuBarProps {
  logo: React.ReactNode;
  onMenuClick: (menu: string) => void;
  searchEnabled: boolean;
  userMenuEnabled: boolean;
}
```

**Height**: 48px (fixed)

### 6.2 Sidebar

```tsx
interface SidebarProps {
  projectTree?: TreeNode[];
  recentProjects?: Project[];
  collapsed: boolean;
  onToggle: () => void;
}
```

**Width**: 240px expanded, 64px collapsed

### 6.3 Context Panel

```tsx
interface ContextPanelProps {
  activeTab: 'inspector' | 'versions' | 'validation' | 'comments' | 'copilot';
  onTabChange: (tab: string) => void;
}
```

**Width**: 320px (resizable 240-480px)

### 6.4 Bottom Activity Dock

```tsx
interface ActivityDockProps {
  tabs: ('runs' | 'jobs' | 'logs' | 'notifications')[];
  activeTab: string;
  expanded: boolean;
}
```

**Height**: 48px collapsed, 240px expanded

---

## 7. File Structure

```
frontend/src/
├── components/
│   ├── layout/
│   │   ├── MenuBar.tsx           # Top menu bar
│   │   ├── Sidebar.tsx           # Left navigation
│   │   ├── ContextPanel.tsx      # Right tabs
│   │   ├── ActivityDock.tsx      # Bottom jobs
│   │   └── Shell.tsx             # Layout container
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   └── features/
│       ├── copilot/
│       ├── workflows/
│       ├── shots/
│       └── ...
├── pages/
│   ├── HomePage.tsx              # Landing (no project)
│   ├── ProjectPage.tsx           # Project workspace
│   └── ComparePage.tsx
├── hooks/
│   ├── useMenuBar.ts
│   ├── useSidebar.ts
│   └── useNavigation.ts
├── stores/
│   ├── layoutStore.ts            # Shell state
│   └── projectStore.ts           # Project state
└── types/
    └── layout.ts
```

---

## 8. Routing Structure

```
/                                   → HomePage (no project context)
/projects/:projectId               → ProjectPage (with shell)
/projects/:projectId/sources       → ProjectPage + SourcesView
/projects/:projectId/canon         → ProjectPage + CanonView
/projects/:projectId/scenes         → ProjectPage + ScenesView
/projects/:projectId/shots         → ProjectPage + ShotsView
/projects/:projectId/workflows     → ProjectPage + WorkflowsView
/projects/:projectId/outputs       → ProjectPage + OutputsView
/projects/:projectId/timeline     → ProjectPage + TimelineView
/projects/:projectId/activity      → ProjectPage + ActivityView
/projects/:projectId/review        → ProjectPage + ReviewView
/projects/:projectId/compare      → ComparePage
```

---

## 9. Implementation Checklist

### Phase 1: Shell Layout

- [ ] Create MenuBar component
- [ ] Refactor Sidebar to support tree structure
- [ ] Implement ContextPanel with tabs
- [ ] Wire up ActivityDock
- [ ] Create unified Shell container

### Phase 2: Home Page

- [ ] Redesign welcome section
- [ ] Move recent projects to sidebar
- [ ] Add "Open Project" modal/dialog
- [ ] Connect to project list API

### Phase 3: Integration

- [ ] Update routing to use new layout
- [ ] Connect sidebar navigation
- [ ] Connect menu bar actions
- [ ] Add keyboard shortcuts

### Phase 4: Polish

- [ ] Add transitions/animations
- [ ] Persist layout preferences
- [ ] Add empty states
- [ ] Add loading states

---

## 10. Migration Path

### Before (Current)

```
App.tsx
  ├── ProjectHomePage (standalone, no shell)
  └── ProjectLayout (inconsistent shell)
```

### After (Redesigned)

```
App.tsx
  └── Shell (always present)
        ├── MenuBar (always present)
        ├── Sidebar (changes based on project state)
        ├── Main Canvas (page content)
        ├── ContextPanel (tabs change based on page)
        └── ActivityDock (toggleable)
```

---

## 11. Design Principles Summary

1. **Menu Bar First** - Global actions accessible from top menu
2. **Sidebar Navigation** - Project structure, always visible in project context
3. **Context Panel** - Tabbed, page-adaptive
4. **Canvas-First** - Main content takes priority
5. **Mode-Aware** - Simple/Guided/Advanced changes info density, not structure
6. **Consistent Patterns** - Every page follows same shell pattern
