# Workflow Implementation Gap Analysis

This document analyzes the gap between the current **Workflow Builder** implementation and the requirements defined in `docs/workflow_master_design_v_1.md` and `docs/workflow_implementation_plan_v_1.md`.

## 1. Lifecycle & Trust Model (High Priority)

The core principle of the Workflow system is the **Draft -> Frozen -> Approved** lifecycle.

| Feature | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Freeze Version** | Every execution must be based on an immutable `WorkflowVersion`. | Users run the `Draft` directly. | **CRITICAL**: No "Freeze Version" action in UI. High risk of non-reproducible runs. |
| **Approval Flow** | Only `Approved` versions should be usable in production/automation. | No approval concept in UI. | Missing "Approve Version" transition. |
| **Versioning UI** | Browse, compare, and revert to previous workflow versions. | Backend supports it; Frontend doesn't. | No "Versions" tab in right panel that lists and allows switching versions. |
| **Branching** | Create a new `Draft` from an existing `Version`. | Manual duplication only. | Missing "Edit this version" button which branches into a new draft. |

## 2. Authoring Modes

The design specifies three distinct UX modes for different user personas.

| Mode | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Advanced Mode** | Visual Graph interaction (Ports, Edges, Pan/Zoom). | **IMPLEMENTED** (Phase 2 Canvas). | None (UX polish only). |
| **Guided Mode** | Vertical card-based list of steps for production focus. | **PARTIAL** (Steps list in Inspector). | No standalone "Guided" view that replaces the graph for simpler editing. |
| **Simple Mode** | Stage-level summaries for beginners. | **MISSING**. | No high-level "Stage" abstraction implemented. |
| **Mode Switcher** | Easy toggle between UI densities. | **MISSING**. | No "Simple/Guided/Advanced" toggle in the toolbar. |

## 3. Node Library & Metadata

| Feature | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Category Layout** | Grouped by Input, Planning, Generation, etc. | **IMPLEMENTED** (Phase 5). | Done. |
| **Search & Filtering** | Ability to search for nodes in the library. | **MISSING**. | Node library is a static list; needs search bar. |
| **Node Definitions** | Rich metadata, help text, and visual hints per type. | **PARTIAL**. | Metadata exists in `workflowCatalog`, but not fully surfaced as "Help" tooltips. |

## 4. Execution & Observability

| Feature | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Live Progress** | Real-time status updates via events. | **IMPLEMENTED** (Phase 10 SSE). | Done. |
| **Run History** | Ability to view and inspect past runs on the canvas. | **PARTIAL**. | Inspector only shows the *latest* run. No run-selection dropdown. |
| **Input Provenance** | See exactly what data snapshots were used for a run. | **MISSING**. | DB records them, but UI does not display "Input Snapshots" for completed runs. |
| **Selective Rerun** | Trigger rerun for a specific node from the canvas. | **MISSING**. | No "Rerun This Node" button on the graph/inspector UI (Backend supports it). |

## 5. Validation System

| Feature | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Persistence** | Validation results stored in DB for history and auditing. | **MISSING**. | Results are transient (on-the-fly API calls only). |
| **Panel Integration** | Centralized list of errors in a dedicated panel. | **MISSING**. | "Validation" tab in right panel is a placeholder. Errors are only shown via toasts/debug strings. |

## 6. Output Integration

| Feature | Design Requirement | Current Status | Gap |
| :--- | :--- | :--- | :--- |
| **Promote to Output** | Explicit action to save run results as a project Asset. | **MISSING**. | Run results stay in `NodeRun` table; no "Save as Asset" button to finalize them. |
| **Lineage** | Trace an Asset back to the Workflow Version/Run that made it. | **MISSING**. | No visual provenance links in the Review or Assets tabs. |

---

## Recommended Gap Closure Order (Priority)

1. **Version Freeze & Approval**: Implement the "Freeze" button to transition from Draft to Version.
2. **Run Selection**: Add a dropdown in the Inspector to switch between past runs for the selected workflow.
3. **Input Snapshot Visibility**: Show exactly what text/parameters were used in a past node run.
4. **Validation Panel**: Replace the placeholder with a real list of graph errors.
5. **Mode Switcher**: Add the Simple/Guided/Advanced toggle to handle UI density.
