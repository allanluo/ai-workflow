# Workflow Master Design v1

## 1. Purpose
Define the workflow system as the central product model of the app.

This document consolidates workflow-related decisions that are currently split across:
- core system design
- execution engine design
- service adapter contract
- frontend workflow UX
- implementation planning

The goal is to make the workflow system understandable as one coherent product and engineering surface.

---

## 2. Why Workflow Is the Core of the App
This app is not just a set of asset editors or generation buttons.
It is a workflow-driven creative production system.

The workflow is the main product object because it defines:
- how source and canon become production assets
- how generation logic is reviewed before execution
- how outputs are produced reproducibly
- how runs, reruns, approvals, and provenance stay traceable

Without the workflow layer, the app becomes a loose collection of tools.
With the workflow layer, the app becomes a reusable production system.

---

## 3. Product Position
The workflow system should feel like:
- a creative production planner
- a reusable pipeline builder
- a reviewable contract for AI-assisted production

It should not feel like:
- a raw automation graph by default
- a low-level provider wiring tool
- a generic prompt playground

The product posture should be:
- story/media-first
- workflow-aware
- guided by default
- graph-capable for advanced users

---

## 4. Core Workflow Principle
A workflow is a versioned, reviewable production recipe.

It defines:
- inputs
- transformation steps
- validation checkpoints
- output assembly
- export behavior

A workflow must support three distinct states:
- editable draft
- frozen version
- approved runnable version

This separation is critical.
Users must be able to edit drafts freely, freeze exact versions, and trust approved versions as stable contracts.

---

## 5. Workflow Layers

### 5.1 Product Layer
What the user sees:
- templates
- stages
- steps
- workflow settings
- validation
- approvals
- run progress

### 5.2 Authoring Layer
How the workflow is edited:
- simple mode
- guided mode
- advanced graph mode

### 5.3 Data Layer
What is persisted:
- workflow definitions
- workflow versions
- workflow runs
- node runs
- resolved inputs
- validation results

### 5.4 Runtime Layer
How the workflow executes:
- dependency resolution
- adapter dispatch
- run lifecycle
- error handling
- rerun behavior

### 5.5 Provenance Layer
What keeps trust and reproducibility:
- exact workflow version used
- exact input snapshots used
- node-by-node execution history
- created assets and export lineage

---

## 6. Core Workflow Objects

### 6.1 Workflow Definition
An editable draft.

Contains:
- metadata
- defaults
- nodes
- edges
- template type
- draft status

Purpose:
- authoring
- iteration
- validation before freeze

### 6.2 Workflow Version
A frozen snapshot of a workflow definition.

Contains:
- exact nodes
- exact edges
- exact defaults
- graph hash
- version number
- approval status

Purpose:
- reproducible execution
- comparison
- auditability

### 6.3 Workflow Run
A specific execution of one workflow version.

Contains:
- workflow version id
- resolved input snapshots
- run status
- progress
- timestamps
- created outputs

Purpose:
- execution tracking
- observability
- rerun lineage

### 6.4 Node Run
A specific execution record for one node within one workflow run.

Contains:
- node id
- effective config
- resolved inputs
- adapter/model metadata
- outputs/artifacts
- timing and status

Purpose:
- debugging
- provenance
- selective rerun support

---

## 7. Workflow Lifecycle
The required lifecycle is:
1. create workflow draft
2. edit workflow draft
3. validate draft
4. freeze workflow version
5. approve workflow version
6. run approved version
7. inspect workflow run and node runs
8. create new draft from previous version when changes are needed

Important rule:
- users should not directly mutate approved workflow versions

Any material change should produce a new draft and then a new version.

---

## 8. Authoring Modes

### 8.1 Simple Mode
Best for:
- beginners
- users who mostly want to run templates

Presentation:
- stage-level summary
- high-level settings
- no graph complexity

### 8.2 Guided Mode
Best for:
- most users
- production operators
- template customization

Presentation:
- ordered step blocks
- editable step config
- constrained branching
- input selection via menus

This should be the default authoring mode.

### 8.3 Advanced Mode
Best for:
- power users
- technical workflow authors
- debugging and exact dependency editing

Presentation:
- draggable node graph
- visible input/output ports
- explicit edges
- node inspector

This should behave more like `n8n` or `ComfyUI`, but inside a story/media-first shell.

---

## 9. Node System
Nodes are reusable creative-production components.

They are the building blocks that let the app support different kinds of workflows without building a different product for each output type.

Nodes must be:
- reusable
- meaningful at the creative-production level
- typed by inputs and outputs
- inspectable
- version-friendly

### 9.1 Node Categories
- Input
- Planning
- Generation
- Validation
- Assembly
- Export

### 9.2 Input Nodes
Input nodes are the entry point of workflows.

They may include:
- uploaded media
- selected project assets
- text area inputs
- prompt inputs
- instructions inputs

Examples:
- `Upload Video`
- `Upload Audio`
- `Select Existing Asset`
- `Story Input`
- `Prompt Input`
- `Instructions Input`

### 9.3 Planning Nodes
Planning nodes transform source and canon into structured production plans.

Examples:
- `Extract Canon`
- `Generate Scenes`
- `Generate Shot Plan`
- `Generate Storyboard`

### 9.4 Generation Nodes
Generation nodes create media or text outputs.

Examples:
- `Generate Image`
- `Generate Video Clip`
- `Generate Narration`
- `Generate Voice`

### 9.5 Validation Nodes
Validation nodes evaluate quality or consistency.

Examples:
- `Validate Continuity`
- `Validate Style`
- `Validate Duration`

### 9.6 Assembly Nodes
Assembly nodes combine generated pieces into intermediate outputs.

Examples:
- `Assemble Sequence`
- `Assemble Timeline`
- `Add Audio Track`
- `Add Captions`

### 9.7 Export Nodes
Export nodes produce preview or final deliverables.

Examples:
- `Render Preview`
- `Render Final`
- `Create Vertical Variant`

---

## 10. Node Design Rules
Each node should define:
- id
- type
- title
- description
- input ports
- output ports
- config schema
- validation rules
- output declarations

Nodes should not expose provider internals in the primary product language.

Good:
- `Generate Video Clip`

Bad:
- `Call ComfyUI JSON`
- `Invoke Video Adapter`

Provider bindings and adapter details belong under implementation metadata, not user-facing node naming.

---

## 11. Edge Model
Edges represent semantic dependencies between nodes.

Each edge should define:
- id
- source node
- destination node
- source output
- destination input
- optional mapping metadata

The graph should stay conceptually simple in v1:
- directed
- mostly acyclic
- explicit dependency edges

The UI should prevent invalid connections.

---

## 12. Reusable Workflow Templates
Templates are packaged workflows built from shared nodes.

This is how the app supports multiple output types without fragmenting into separate products.

Example templates:
- storyboard from story
- short video from prompt
- narrated story video
- music video

Templates should provide:
- prewired valid node flows
- defaults
- human-readable stage explanations
- editable settings

Users should start from templates by default.
Blank graph creation should be secondary.

---

## 13. Data and Contract Model
The underlying data model should stay consistent across all workflow modes.

The canonical editable workflow shape should contain:
- `defaults`
- `nodes`
- `edges`
- `metadata`

The frozen workflow version should add:
- `graph_hash`
- version metadata
- approval state
- runtime environment metadata when needed

The workflow run should add:
- resolved exact inputs
- progress
- run status
- node run ids

The node run should add:
- effective config
- adapter/model metadata
- outputs
- error details

---

## 14. Input Resolution Model
Workflow inputs may come from:
- literal values
- text areas
- uploaded files
- exact asset references
- queries resolved at run start
- upstream node outputs
- workflow defaults

Important rule:
- any dynamic input must resolve into an exact snapshot at run start and be recorded in the workflow run or node run

This is required for trust and rerun traceability.

---

## 15. Execution Model
Execution should be based on the frozen workflow version, not the mutable draft.

High-level execution flow:
1. load workflow version
2. validate run-time requirements
3. resolve inputs into exact snapshots
4. determine runnable nodes from edges
5. execute nodes through adapters
6. persist node runs
7. create output assets and links
8. update workflow run progress
9. surface events to the UI

Execution should support:
- deterministic replay where possible
- partial rerun later
- clear failure classification

---

## 16. Approval Model
Approval is central to the workflow trust model.

Rules:
- drafts are editable and not runnable as approved contracts
- frozen versions are immutable snapshots
- approved versions are the trusted runnable contract
- editing an approved workflow requires branching into a new draft

The UI must make these states visually obvious.

---

## 17. Validation Model
Workflow validation should exist at multiple levels:
- structure validation
- node config validation
- connection compatibility validation
- asset/input availability validation
- output contract validation

Validation should happen:
- inline during authoring
- explicitly on validate action
- before freeze
- before run

Validation results should be understandable to non-technical users.

---

## 18. Workflow UX Rules
The workflow UX should obey these rules:

1. Default to guided mode.
2. Do not force users to understand edges before they understand stages.
3. Use drag-and-drop graph editing only in advanced mode.
4. Always show where inputs come from and what outputs are produced.
5. Make run progress visible on both workflow and node level.
6. Use templates to teach the workflow model.
7. Keep node names product-meaningful.
8. Never make raw node/edge JSON the primary editing surface.

---

## 19. Observability and Provenance
Users should be able to inspect:
- which workflow version ran
- which exact inputs were used
- which node failed
- which assets were created
- which export was produced

This requires:
- workflow runs
- node runs
- project events
- asset links
- generation/service metadata

Without this, the workflow system is not trustworthy enough for production use.

---

## 20. Initial Launch Scope
The first workflow release should prioritize:
- template-based creation
- guided authoring
- basic advanced graph mode
- input/planning/generation/validation/assembly/export node categories
- exact workflow version freeze
- workflow runs and node runs
- run inspection

It should defer:
- highly generic graph programming
- complex branching/merging logic
- marketplace-style workflow packs
- provider-level wiring in the UI

---

## 21. Recommended Default Workflow Path
For most users, the ideal path is:
1. choose template
2. fill in source and prompt inputs
3. review guided steps
4. validate
5. freeze and approve
6. run workflow
7. inspect outputs
8. revise by creating a new draft

This should be the core loop the app is optimized around.

---

## 22. Open Decisions That Still Need Explicit Resolution
- which node fields are editable in guided mode vs advanced mode
- how much branching is allowed in v1 guided mode
- whether workflow validation results should be persisted as first-class records immediately
- which node types are in the initial launch library vs later
- how far partial rerun should go in the first production release

---

## 23. Summary
The workflow is the main product contract of the app.

It is:
- the reusable production recipe
- the reviewed and approved logic layer
- the bridge between assets and outputs
- the main source of reproducibility, traceability, and reuse

The app should therefore be built around:
- strong workflow versioning
- guided-first workflow authoring
- reusable node building blocks
- observable execution
- reviewable and approvable workflow contracts
