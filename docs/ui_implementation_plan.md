# UI Implementation Plan

## Overview

This plan outlines the implementation steps for the complete UI redesign based on:

- `docs/single_page_ui_design.md` - Layout and structure
- `docs/comfyui_style_design.md` - CSS design system

**Goal**: Replace all current inconsistent UI with a unified ComfyUI-style dark theme shell architecture.

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Set up the CSS design system and create base components.

#### 1.1 Tailwind Configuration

```javascript
// tailwind.config.js - Update with ComfyUI colors
```

| Task  | Description                                     |
| ----- | ----------------------------------------------- |
| 1.1.1 | Add custom color palette to tailwind.config.js  |
| 1.1.2 | Configure font families (Inter, JetBrains Mono) |
| 1.1.3 | Set up spacing and border radius tokens         |
| 1.1.4 | Add custom box shadows                          |

#### 1.2 Global CSS

```css
/* src/styles.css */
```

| Task  | Description                                 |
| ----- | ------------------------------------------- |
| 1.2.1 | Add CSS custom properties for design tokens |
| 1.2.2 | Create global dark theme base styles        |
| 1.2.3 | Add custom scrollbar styling                |
| 1.2.4 | Add transition utility classes              |

#### 1.3 Base Components

Create reusable component primitives:

| Component | File                               | Description                              |
| --------- | ---------------------------------- | ---------------------------------------- |
| Button    | `src/components/common/Button.tsx` | Primary, Secondary, Ghost, Icon variants |
| Input     | `src/components/common/Input.tsx`  | Text, Number, Search, Select             |
| Badge     | `src/components/common/Badge.tsx`  | Status badges                            |
| Card      | `src/components/common/Card.tsx`   | Panel/card wrapper                       |
| Tabs      | `src/components/common/Tabs.tsx`   | Tab navigation                           |

---

### Phase 2: Shell Layout (Week 2)

**Goal**: Build the unified shell architecture that wraps all pages.

#### 2.1 Menu Bar

| Task  | Description                                           |
| ----- | ----------------------------------------------------- |
| 2.1.1 | Create `MenuBar` component                            |
| 2.1.2 | Implement File menu (New, Open, Import, Export, Quit) |
| 2.1.3 | Implement Edit menu (Undo, Redo, Cut, Copy, Paste)    |
| 2.1.4 | Implement View menu (Toggle Sidebar, Panel, Dock)     |
| 2.1.5 | Implement Project menu (Settings, Workflows, Runs)    |
| 2.1.6 | Implement Help menu                                   |
| 2.1.7 | Add search input and user menu                        |

#### 2.2 Sidebar

| Task  | Description                                    |
| ----- | ---------------------------------------------- |
| 2.2.1 | Create `Sidebar` component with tree structure |
| 2.2.2 | Implement project tree navigation              |
| 2.2.3 | Add expand/collapse for nested items           |
| 2.2.4 | Add collapse to icon rail mode                 |
| 2.2.5 | Handle empty state (no project)                |
| 2.2.6 | Add right-click context menu                   |

#### 2.3 Top Toolbar

| Task  | Description                                      |
| ----- | ------------------------------------------------ |
| 2.3.1 | Create `TopToolbar` component                    |
| 2.3.2 | Implement breadcrumb display                     |
| 2.3.3 | Add page-specific action buttons                 |
| 2.3.4 | Implement mode switcher (Simple/Guided/Advanced) |
| 2.3.5 | Connect to project context                       |

#### 2.4 Context Panel

| Task  | Description                            |
| ----- | -------------------------------------- |
| 2.4.1 | Create `ContextPanel` component        |
| 2.4.2 | Implement tab navigation               |
| 2.4.3 | Create Inspector tab content           |
| 2.4.4 | Create Versions tab content            |
| 2.4.5 | Create Validation tab content          |
| 2.4.6 | Create Comments tab content            |
| 2.4.7 | Create Copilot tab content placeholder |

#### 2.5 Bottom Activity Dock

| Task  | Description                                                |
| ----- | ---------------------------------------------------------- |
| 2.5.1 | Create `ActivityDock` component                            |
| 2.5.2 | Implement tab navigation (Runs, Jobs, Logs, Notifications) |
| 2.5.3 | Add expand/collapse toggle                                 |
| 2.5.4 | Create job list display                                    |
| 2.5.5 | Add progress indicators                                    |

#### 2.6 Shell Container

| Task  | Description                                       |
| ----- | ------------------------------------------------- |
| 2.6.1 | Create `Shell` component to wrap all layout parts |
| 2.6.2 | Implement responsive collapse behavior            |
| 2.6.3 | Add resize handles for panels                     |
| 2.6.4 | Connect layout state to Zustand store             |
| 2.6.5 | Add persistence for layout preferences            |

---

### Phase 3: Home Page (Week 2-3)

**Goal**: Redesign the landing page with unified shell.

| Task | Description                                        |
| ---- | -------------------------------------------------- |
| 3.1  | Remove old ProjectHomePage                         |
| 3.2  | Create new HomePage inside Shell                   |
| 3.3  | Implement welcome section with Create/Open buttons |
| 3.4  | Create Recent Projects list                        |
| 3.5  | Add Quick Access sidebar content                   |
| 3.6  | Add Context Panel (Copilot placeholder)            |
| 3.7  | Create Project creation modal                      |
| 3.8  | Create Project open dialog                         |

---

### Phase 4: Page Views (Week 3-6)

Implement each page with the unified shell and page-specific patterns.

#### 4.1 Sources Page

| Task  | Description                            |
| ----- | -------------------------------------- |
| 4.1.1 | Create file list with icons            |
| 4.1.2 | Add filter/search                      |
| 4.1.3 | Create file preview panel              |
| 4.1.4 | Add upload dropzone                    |
| 4.1.5 | Connect to API                         |
| 4.1.6 | Set default context panel to Inspector |

#### 4.2 Canon Page

| Task  | Description                            |
| ----- | -------------------------------------- |
| 4.2.1 | Create canon category tree             |
| 4.2.2 | Build rich text editor for canon items |
| 4.2.3 | Add version history panel              |
| 4.2.4 | Implement approval workflow            |
| 4.2.5 | Set default context panel to Versions  |

#### 4.3 Scenes Page

| Task  | Description                            |
| ----- | -------------------------------------- |
| 4.3.1 | Create scene list/grid view            |
| 4.3.2 | Build scene detail editor              |
| 4.3.3 | Add scene reordering (drag)            |
| 4.3.4 | Create scene preview                   |
| 4.3.5 | Add validation indicators              |
| 4.3.6 | Set default context panel to Inspector |

#### 4.4 Shots Page (Critical)

| Task  | Description                             |
| ----- | --------------------------------------- |
| 4.4.1 | Create shot list with thumbnails        |
| 4.4.2 | Build shot editor (prompt, camera)      |
| 4.4.3 | Add image/video preview stack           |
| 4.4.4 | Implement regenerate action             |
| 4.4.5 | Add validation status display           |
| 4.4.6 | Create compare view                     |
| 4.4.7 | Set default context panel to Validation |

#### 4.5 Workflows Page

| Task  | Description                          |
| ----- | ------------------------------------ |
| 4.5.1 | Create workflow selector             |
| 4.5.2 | Build version selector               |
| 4.5.3 | Implement Simple mode (stages)       |
| 4.5.4 | Implement Guided mode (step blocks)  |
| 4.5.5 | Implement Advanced mode (node graph) |
| 4.5.6 | Add validate/freeze/run buttons      |
| 4.5.7 | Set default context panel to Copilot |

#### 4.6 Outputs Page

| Task  | Description                                         |
| ----- | --------------------------------------------------- |
| 4.6.1 | Create output type list (Film, Music Video, Shorts) |
| 4.6.2 | Build output detail view                            |
| 4.6.3 | Add output version selector                         |
| 4.6.4 | Implement approval workflow                         |
| 4.6.5 | Create export dialog                                |
| 4.6.6 | Set default context panel to Inspector              |

#### 4.7 Timeline Page

| Task  | Description                           |
| ----- | ------------------------------------- |
| 4.7.1 | Create output selector                |
| 4.7.2 | Build video player component          |
| 4.7.3 | Implement timeline with tracks        |
| 4.7.4 | Add clip editing controls             |
| 4.7.5 | Create export settings dialog         |
| 4.7.6 | Set default context panel to Comments |

#### 4.8 Review Page

| Task  | Description                            |
| ----- | -------------------------------------- |
| 4.8.1 | Create diff/compare viewer             |
| 4.8.2 | Build side-by-side comparison          |
| 4.8.3 | Add approve/reject actions             |
| 4.8.4 | Create comment thread                  |
| 4.8.5 | Add change highlights                  |
| 4.8.6 | Set default context panel to Approvals |

#### 4.9 Activity Page

| Task  | Description                            |
| ----- | -------------------------------------- |
| 4.9.1 | Create workflow runs table             |
| 4.9.2 | Build node runs display                |
| 4.9.3 | Add log viewer                         |
| 4.9.4 | Implement retry/rerun actions          |
| 4.9.5 | Add filtering and search               |
| 4.9.6 | Set default context panel to Inspector |

---

### Phase 5: Integration (Week 6-7)

Connect all pages and features together.

#### 5.1 Routing

| Task  | Description                      |
| ----- | -------------------------------- |
| 5.1.1 | Update App.tsx routing structure |
| 5.1.2 | Ensure all routes use Shell      |
| 5.1.3 | Add breadcrumb navigation        |
| 5.1.4 | Handle deep linking              |

#### 5.2 State Management

| Task  | Description                    |
| ----- | ------------------------------ |
| 5.2.1 | Update Zustand layout store    |
| 5.2.2 | Connect panels to page context |
| 5.2.3 | Handle mode switching state    |
| 5.2.4 | Add layout persistence         |

#### 5.3 Keyboard Shortcuts

| Task  | Description                                       |
| ----- | ------------------------------------------------- |
| 5.3.1 | Implement global shortcuts (Ctrl+N, Ctrl+O, etc.) |
| 5.3.2 | Add page-specific shortcuts                       |
| 5.3.3 | Create keyboard shortcut reference                |

#### 5.4 Global Search

| Task  | Description                  |
| ----- | ---------------------------- |
| 5.4.1 | Create search modal/dropdown |
| 5.4.2 | Implement search index       |
| 5.4.3 | Add search result navigation |
| 5.4.4 | Add keyboard navigation      |

---

### Phase 6: Polish (Week 7-8)

Final touches and edge cases.

| Task | Description                             |
| ---- | --------------------------------------- |
| 6.1  | Add loading states (skeleton loaders)   |
| 6.2  | Add empty states for all lists          |
| 6.3  | Add error states and recovery           |
| 6.4  | Verify all hover/focus states           |
| 6.5  | Test accessibility (keyboard nav, ARIA) |
| 6.6  | Add animations and transitions          |
| 6.7  | Performance optimization                |
| 6.8  | Cross-browser testing                   |

---

## File Structure

```
frontend/src/
├── components/
│   ├── common/                    # Phase 1
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Tabs.tsx
│   │   ├── Modal.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Toast.tsx
│   │   └── index.ts
│   │
│   ├── layout/                    # Phase 2
│   │   ├── Shell.tsx              # Main container
│   │   ├── MenuBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopToolbar.tsx
│   │   ├── ContextPanel.tsx
│   │   ├── ActivityDock.tsx
│   │   └── index.ts
│   │
│   ├── patterns/                  # Reusable patterns
│   │   ├── ListPanel.tsx
│   │   ├── TreeView.tsx
│   │   ├── VideoPlayer.tsx
│   │   ├── PreviewStack.tsx
│   │   └── index.ts
│   │
│   └── features/                  # Feature-specific
│       ├── copilot/
│       ├── workflows/
│       ├── shots/
│       └── ...
│
├── pages/
│   ├── HomePage.tsx               # Phase 3
│   ├── SourcesPage.tsx            # Phase 4.1
│   ├── CanonPage.tsx              # Phase 4.2
│   ├── ScenesPage.tsx             # Phase 4.3
│   ├── ShotsPage.tsx              # Phase 4.4
│   ├── WorkflowsPage.tsx          # Phase 4.5
│   ├── OutputsPage.tsx            # Phase 4.6
│   ├── TimelinePage.tsx           # Phase 4.7
│   ├── ReviewPage.tsx             # Phase 4.8
│   └── ActivityPage.tsx           # Phase 4.9
│
├── hooks/
│   ├── useLayout.ts
│   ├── useNavigation.ts
│   └── useKeyboard.ts
│
├── stores/
│   ├── layoutStore.ts
│   ├── uiStore.ts
│   └── projectStore.ts
│
├── styles/
│   └── globals.css                # Phase 1
│
├── tailwind.config.js             # Phase 1
│
└── App.tsx                        # Phase 5
```

---

## Component Dependencies

```
Shell (Phase 2)
├── MenuBar
├── Sidebar
├── TopToolbar
├── ContextPanel
│   ├── InspectorTab
│   ├── VersionsTab
│   ├── ValidationTab
│   ├── CommentsTab
│   └── CopilotTab
└── ActivityDock

Shell wraps:
├── HomePage
├── SourcesPage
├── CanonPage
├── ScenesPage
├── ShotsPage
├── WorkflowsPage
├── OutputsPage
├── TimelinePage
├── ReviewPage
└── ActivityPage
```

---

## API Dependencies

| Page      | API Endpoints                                             |
| --------- | --------------------------------------------------------- |
| Home      | `GET /projects`, `POST /projects`                         |
| Sources   | `GET /sources`, `POST /sources`, `DELETE /sources/:id`    |
| Canon     | `GET /canon`, `POST /canon`, `PUT /canon/:id`             |
| Scenes    | `GET /scenes`, `POST /scenes`, `PUT /scenes/:id`          |
| Shots     | `GET /shots`, `POST /shots`, `PUT /shots/:id`             |
| Workflows | `GET /workflows`, `POST /workflows`, `PUT /workflows/:id` |
| Outputs   | `GET /outputs`, `POST /outputs`, `PUT /outputs/:id`       |
| Timeline  | `GET /outputs/:id/timeline`                               |
| Activity  | `GET /runs`, `GET /jobs`                                  |

---

## Testing Strategy

### Unit Tests

- Button variants
- Input validation
- Badge rendering
- Tab switching

### Integration Tests

- Shell layout renders correctly
- Sidebar navigation works
- Context panel tabs switch
- Theme applied consistently

### E2E Tests (Playwright)

- Create new project flow
- Navigate through all pages
- Workflow creation and running
- Export flow

---

## Definition of Done

- [ ] All pages use unified Shell layout
- [ ] ComfyUI dark theme applied consistently
- [ ] Menu bar fully functional
- [ ] Sidebar navigation works for all pages
- [ ] Context panel shows appropriate content per page
- [ ] Bottom activity dock shows jobs/runs
- [ ] All keyboard shortcuts work
- [ ] Global search functional
- [ ] Loading and empty states handled
- [ ] No mixed styles (old Tailwind classes)
- [ ] Responsive collapse behavior works

---

## Potential Blockers

1. **Backend API readiness** - Some pages depend on API endpoints
2. **Copilot backend** - Will need placeholder if not ready
3. **Node graph component** - May need third-party library
4. **Video player** - Complex component, may need extra time

---

## Effort Estimation

| Phase     | Tasks        | Estimated Hours |
| --------- | ------------ | --------------- |
| Phase 1   | Foundation   | 16h             |
| Phase 2   | Shell Layout | 24h             |
| Phase 3   | Home Page    | 8h              |
| Phase 4   | Page Views   | 40h             |
| Phase 5   | Integration  | 16h             |
| Phase 6   | Polish       | 16h             |
| **Total** |              | **120h**        |

---

## Next Steps

1. **Start Phase 1**: Set up Tailwind config and global CSS
2. **Create base components**: Button, Input, Badge, Card, Tabs
3. **Build shell**: MenuBar, Sidebar, TopToolbar, ContextPanel, ActivityDock
4. **Migrate pages**: One page at a time, replacing old components
5. **Polish**: Add transitions, animations, edge cases
