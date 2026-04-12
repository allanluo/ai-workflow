# Workflow Implementation Plan v1

## 1. Purpose
Define the execution plan for building the workflow system as the central part of the app.

This plan is narrower than the repo-wide implementation plan.
It focuses specifically on:
- workflow authoring
- workflow graph editing
- workflow validation
- workflow execution
- workflow observability
- workflow-driven output production

This should be treated as the primary implementation plan for the app’s core feature.

---

## 2. Desired End State
The workflow system is complete for v1 when a user can:
1. create or duplicate a workflow from a template
2. edit it in guided mode
3. inspect and optionally refine it in advanced graph mode
4. validate it
5. freeze it into a workflow version
6. approve it
7. run it
8. inspect workflow and node progress live
9. inspect created assets and outputs
10. revise by branching into a new draft

---

## 3. Current Starting Point
Based on the current repo state:
- basic workflow CRUD exists
- workflow validation endpoint exists
- workflow version creation exists
- workflow runs and node runs exist at a basic level
- rerun support exists
- the workflows UI now has richer draft editing than before

However, major workflow gaps still exist:
- no true guided workflow builder model
- no real advanced graph canvas with ports and drag-to-connect edges
- no coherent node library UX
- no workflow-centered product flow tying authoring, execution, review, and output creation together
- incomplete observability and output/export integration

---

## 4. Implementation Principles
1. Build the workflow as the main product loop, not as an isolated page.
2. Prefer guided authoring first, graph authoring second.
3. Keep one underlying workflow model across simple, guided, and advanced modes.
4. Keep nodes product-meaningful and reusable.
5. Persist exact execution state before adding richer automation.
6. Make every major phase vertically testable from UI to backend.
7. Use templates to constrain complexity early.

---

## 5. Workstreams
The workflow system should be implemented through six coordinated workstreams:

1. Workflow contracts and schema
2. Guided authoring UX
3. Advanced graph UX
4. Execution runtime and observability
5. Output/review integration
6. Testing and hardening

These workstreams overlap, but the delivery order matters.

---

## 6. Phase 1: Freeze the Workflow Contract
Goal:
- stabilize the workflow data model and authoring contract before deeper UI work

### Backend
- verify and normalize workflow definition schema
- verify workflow version snapshot shape
- verify workflow run and node run shapes
- add any missing validation contract fields
- add missing approval metadata if needed

### Database
- verify `workflow_definitions`
- verify `workflow_versions`
- verify `workflow_runs`
- verify `node_runs`
- add missing fields required for graph hash, resolved inputs, and validation persistence

### Frontend
- align API client types with final workflow schema
- remove assumptions that treat workflows as simple forms only
- prepare client-side types for guided and advanced mode state

### Deliverables
- stable workflow schema
- stable validation response shape
- stable workflow version freeze contract

### Exit Criteria
- one canonical workflow definition shape is used across backend and frontend
- freeze and validate behavior are deterministic
- no major schema ambiguity remains for node, edge, or defaults editing

---

## 7. Phase 2: Build Guided Workflow Authoring
Goal:
- make workflow authoring usable for normal users without requiring graph knowledge

### UX Scope
- workflow template picker
- guided step list
- add step
- reorder step
- duplicate step
- delete step
- input selection
- step-level config editing
- inline validation

### Backend
- ensure draft update route supports structured guided edits cleanly
- add helper validations for guided constraints
- support template duplication into drafts

### Frontend
- replace raw node/edge editing patterns with guided step blocks
- create structured editors for:
  - workflow defaults
  - step config
  - input source selection
- add validation summary and per-step validation display
- add template-driven workflow creation flow

### Suggested UI Components
- `WorkflowTemplatePicker`
- `GuidedWorkflowEditor`
- `WorkflowStepCard`
- `StepConfigPanel`
- `WorkflowValidationPanel`

### Testing
- create workflow from template
- reorder valid guided steps
- reject invalid guided reorder
- add required step and validate
- save draft and reload it

### Exit Criteria
- a non-technical user can build and validate a workflow without understanding nodes and edges

---

## 8. Phase 3: Introduce the Node Library
Goal:
- turn workflow steps into reusable production building blocks

### Scope
- define launch node library
- define category grouping
- define display names and descriptions
- define input/output typing
- define config schema for each launch node

### Initial Node Groups
- Input
- Planning
- Generation
- Validation
- Assembly
- Export

### Initial Launch Nodes
- `Story Input`
- `Prompt Input`
- `Upload Audio`
- `Upload Video`
- `Extract Canon`
- `Generate Scenes`
- `Generate Shot Plan`
- `Generate Image`
- `Generate Video Clip`
- `Generate Narration`
- `Validate Continuity`
- `Assemble Timeline`
- `Render Preview`
- `Render Final`

### Backend
- formalize node type registry
- formalize node validation rules
- formalize node input/output declarations

### Frontend
- create node library metadata used by both guided and advanced modes
- support node categories and search
- support add-step from node library

### Exit Criteria
- the app has a reusable workflow node library rather than ad hoc workflow steps

---

## 9. Phase 4: Build Advanced Graph Authoring
Goal:
- expose the exact workflow graph for advanced users

### UX Scope
- canvas
- pan and zoom
- draggable nodes
- visible input and output ports
- drag-to-connect edges
- edge validation
- auto layout
- node inspector
- edge inspector

### Backend
- no major new route class should be required if the workflow schema is already stable
- add any missing validation helpers for connection compatibility and cycle prevention

### Frontend
- implement a real graph interaction layer
- map node library entries into graph nodes
- create graph selection and inspector state
- keep advanced graph synchronized with guided representation

### Critical Rules
- guided mode and advanced mode must edit the same underlying workflow data
- advanced constructs unsupported in guided mode must not be silently lost

### Testing
- create node from library
- connect compatible ports
- reject incompatible ports
- preserve graph after save/reload
- switch between guided and advanced without data loss

### Exit Criteria
- advanced users can visually author and inspect workflows with drag-and-drop nodes and explicit edges

---

## 10. Phase 5: Workflow Validation and Approval Hardening
Goal:
- make workflow trust and review behavior production-worthy

### Validation Scope
- structure validation
- required input validation
- node config validation
- connection compatibility validation
- output contract validation

### Approval Scope
- draft vs frozen vs approved state clarity
- duplicate-as-draft from frozen version
- explicit approval actions
- immutable approved versions

### Backend
- standardize validation error codes and messages
- add missing persistence for validation results if chosen for v1
- ensure approved workflow versions cannot be mutated

### Frontend
- show validation errors inline on steps and graph nodes
- show workflow validation summary
- make freeze and approval states visually distinct

### Testing
- invalid workflow cannot freeze
- unapproved workflow cannot run where approval is required
- approved workflow cannot be edited in place

### Exit Criteria
- users can trust that approved workflow versions are stable and runnable contracts

---

## 11. Phase 6: Workflow Execution and Run Inspection
Goal:
- make approved workflow versions executable with useful live feedback

### Runtime Scope
- workflow run creation
- node run creation
- dependency-based execution
- resolved input snapshots
- retry/failure behavior
- progress events

### Backend
- harden execution engine scheduling
- persist exact node inputs and effective config
- persist output artifacts and created assets
- emit project events for workflow and node transitions

### Frontend
- run workflow from workflow page
- show live run progress
- show node-level status
- show run detail and node detail inspection
- show created assets and outputs from a run

### Testing
- run workflow from approved version
- inspect node transitions
- inspect failed node error details
- rerun supported cases

### Exit Criteria
- a user can run an approved workflow and understand what happened node by node

---

## 12. Phase 7: Workflow-to-Output Integration
Goal:
- make workflows feel like the main path to outputs rather than an isolated authoring tool

### Scope
- create output versions from workflow runs
- connect workflow outputs to review surface
- connect workflow outputs to export actions
- show output lineage back to workflow versions and runs

### Backend
- ensure output creation can be tied cleanly to workflow runs
- ensure export jobs preserve workflow provenance
- ensure asset links are created for generated and assembled outputs

### Frontend
- enable “create output from run”
- show run-produced outputs on the workflow page
- show related workflow version/run on output and review pages

### Testing
- run workflow
- create output from workflow results
- request export from produced output
- inspect full lineage

### Exit Criteria
- workflows are clearly the main route from source material to final output

---

## 13. Phase 8: Workflow Hardening
Goal:
- make the workflow system stable enough for daily use

### Scope
- test coverage expansion
- stale state handling
- reconnect and event replay
- large project performance
- draft conflict safety
- better empty states and onboarding

### Areas to Harden
- event replay after refresh
- partial failure handling
- adapter unavailability
- graph save/load fidelity
- validation clarity
- run cancellation and retry surfaces

### Exit Criteria
- workflow authoring and execution feel dependable on a normal local setup

---

## 14. Suggested Build Order by Module
Recommended implementation order:
1. finalize workflow schema and node registry
2. template creation flow
3. guided workflow editor
4. guided validation UX
5. workflow approval/freeze polish
6. node library metadata layer
7. advanced graph editor
8. run monitoring and node inspection
9. workflow-to-output flow
10. hardening and onboarding

This order keeps the product usable early while avoiding premature graph-first complexity.

---

## 15. Recommended File-Level Focus Areas

### Frontend
- workflow page
- workflow editor components
- node library metadata
- validation panels
- run detail components
- graph state store

### Backend
- workflow routes
- execution engine
- validation helpers
- node registry
- project event streaming

### Database
- workflow definitions and versions
- workflow runs and node runs
- validation result persistence if added
- asset link creation for workflow outputs

---

## 16. Key Risks

### Risk 1: The product ships as raw graph tooling
Mitigation:
- default to guided mode
- use templates
- keep graph mode advanced-only

### Risk 2: Guided and advanced modes diverge
Mitigation:
- one shared underlying workflow schema
- one node registry
- explicit mapping rules

### Risk 3: Node types become provider-coupled
Mitigation:
- keep node names product-meaningful
- keep provider details in adapters

### Risk 4: Execution is hard to trust
Mitigation:
- persist exact inputs
- persist node runs
- show run inspection clearly

### Risk 5: Workflow page stays disconnected from outputs
Mitigation:
- explicitly implement workflow-to-output actions and lineage

---

## 17. Definition of Done for the Workflow System
The workflow system is done for v1 when:
- templates exist and are usable
- guided mode supports real authoring
- advanced mode supports real graph editing
- workflow validation is understandable
- freeze and approval states are trustworthy
- approved workflow versions run successfully
- workflow and node runs are inspectable
- workflow results lead naturally into review, outputs, and export

---

## 18. Immediate Next Steps
Recommended next implementation tasks:
1. replace any remaining raw workflow JSON editing with structured guided editors
2. define the first concrete node library metadata module
3. implement template-based workflow creation
4. define guided-to-advanced mapping rules in code
5. build the first real graph canvas with visible ports

---

## 19. Summary
The workflow system should be treated as the main feature of the app.

The right delivery strategy is:
- guided-first authoring
- reusable nodes
- advanced graph editing for power users
- strong versioning and approval
- observable execution
- tight workflow-to-output integration

This plan should govern the app’s core implementation work ahead of secondary surfaces.
