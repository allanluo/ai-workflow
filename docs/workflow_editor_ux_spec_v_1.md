# Workflow Editor UX Spec v1

## 1. Purpose
Define how users create, understand, edit, connect, validate, and run workflows in the product UI.

This fills a gap in the current docs:
- existing docs say the product should support `simple`, `guided`, and `advanced` workflow modes
- existing docs do not specify how node and edge editing should actually work
- this document defines the interaction model so the workflow page can be designed and implemented coherently

This spec is intentionally closer to:
- `n8n` for guided workflow authoring
- `ComfyUI` for clear visual graph mechanics in advanced mode

It is intentionally not:
- a blank technical graph as the default experience
- a raw JSON editor for nodes and edges
- a generic automation builder detached from story/media work

---

## 2. Product Position
The workflow system should feel like a creative production planner with optional graph power tools.

The default user experience should be:
- story-first
- preset-first
- step-first
- graph-optional

The graph is a power-user representation of the workflow.
It is not the first thing a normal user should have to understand.

---

## 3. Design Goals
The workflow editor must:
- make users understand what happens next
- make node relationships visually obvious
- let beginners create and edit workflows without knowing graph theory
- let advanced users inspect and modify exact flow structure
- preserve a single underlying workflow model across all modes
- expose enough execution detail to build trust

The workflow editor must not:
- require users to manually author edges for basic flows
- show raw schema structure before the user understands the task
- force users to start from an empty graph

---

## 4. User Modes

### 4.1 Simple Mode
Audience:
- beginners
- users who only want to run or lightly tweak a workflow

Primary presentation:
- stage cards
- plain-language settings
- no visible node graph

What users can do:
- pick a workflow template
- review stage summaries
- edit high-level settings
- validate
- freeze version
- run

What users cannot do:
- directly create arbitrary nodes
- directly draw edges
- edit low-level node wiring

### 4.2 Guided Mode
Audience:
- normal product users
- users who want control over workflow composition without graph complexity

Primary presentation:
- ordered step list
- each step shown as a stage block
- expandable configuration panels
- connection logic mostly implied by order and step type

What users can do:
- add a step from a menu
- reorder steps
- duplicate or remove steps
- choose from valid inputs for each step
- branch using explicit guided controls
- validate and run the workflow

What users usually do not need to do:
- manually draw edges

### 4.3 Advanced Mode
Audience:
- power users
- workflow authors
- debugging and inspection use

Primary presentation:
- node graph canvas
- draggable nodes
- visible input and output ports
- explicit edges
- side inspector for node config

What users can do:
- create nodes
- connect nodes visually
- inspect exact dependencies
- edit node-level settings
- inspect node run status and artifacts

---

## 5. Core UX Rule
Every workflow must be editable in all three modes through the same underlying data model:
- `nodes`
- `edges`
- `defaults`
- `metadata`

Mode differences are representational, not structural.

Simple mode hides graph structure.
Guided mode constrains graph editing into step-level operations.
Advanced mode exposes the actual graph.

---

## 6. Default Entry Experience
Users should not start with an empty graph by default.

Preferred workflow creation flow:
1. choose a template
2. review stages
3. edit settings in guided mode
4. optionally open advanced mode

Default templates should include:
- `Story to Scenes to Shots`
- `Script to Storyboard`
- `Canon Extraction and Scene Planning`
- `Scenes to Preview Render`
- `Short Video Assembly`

Each template should include:
- human-readable stage names
- a prewired valid flow
- editable defaults
- a short explanation of what each step produces

Blank workflow creation should exist, but only as an advanced option.

---

## 7. Workflow Page Layout

### 7.1 Shared Layout
- Top bar: workflow selector, version selector, mode switcher, status
- Center: mode-specific editor
- Right panel: inspector, versions, validation, approvals
- Bottom panel: run status, node status, logs

### 7.2 Top Bar Actions
- `New Workflow`
- `Duplicate`
- `Validate`
- `Freeze Version`
- `Approve`
- `Run`
- `Mode: Simple / Guided / Advanced`

### 7.3 Right Panel Tabs
- `Inspector`
- `Versions`
- `Validation`
- `Approvals`
- `Copilot`

### 7.4 Bottom Panel
- workflow run progress
- node status list
- warnings and failures
- latest outputs

---

## 8. Guided Mode Spec

### 8.1 Mental Model
Guided mode should feel like editing a production recipe, not assembling a software graph.

Each step is a block with:
- title
- type
- short description
- inputs summary
- outputs summary
- status

Example guided sequence:
- `Extract Canon`
- `Generate Scenes`
- `Generate Shots`
- `Render Preview`

### 8.2 Step Card Anatomy
Each step card shows:
- step name
- node type label
- status badge
- primary input source
- primary output type
- quick actions: edit, duplicate, delete

Expanded card shows:
- purpose
- inputs
- editable settings
- output expectations
- validation warnings

### 8.3 Adding Steps
Users add steps through an `Add Step` control between existing steps or at the end.

The add-step menu should:
- group steps by category
- use plain-language names
- show a one-line explanation
- show whether the step fits the current location

Recommended categories:
- Inputs
- Planning
- Generation
- Validation
- Assembly
- Export

Example labels:
- `Extract Canon`
- `Plan Scenes`
- `Generate Shot List`
- `Generate Visuals`
- `Validate Continuity`
- `Assemble Preview`
- `Create Export`

### 8.4 Reordering Steps
For simple linear flows, users can drag step cards up or down.

When a reorder would break dependencies:
- prevent the action, or
- require confirmation and auto-repair the flow if possible

Users should never have to manually reconnect every edge after a basic reorder in guided mode.

### 8.5 Branching in Guided Mode
Branching should be explicit and constrained.

Allowed guided branching patterns:
- split one upstream result into two downstream generation paths
- insert validation checkpoint before approval
- add export branch from approved outputs

Branching UI should use:
- `Add Branch`
- `Use Output From`
- `Merge Into`

Guided mode should not expose arbitrary graph editing controls.

### 8.6 Input Selection
Each step should show where its inputs come from in plain language.

Examples:
- `Uses scenes from: Plan Scenes`
- `Uses canon from: Extract Canon`
- `Uses style defaults from: Workflow Settings`

Users should select inputs from menus, not by editing edge ids.

### 8.7 Guided Validation
Validation should appear inline on each step card.

Common messages:
- `Missing required input: canon`
- `No downstream step uses this output`
- `This step expects scenes but receives shots`
- `Preview render requires at least one visual generation step`

Each error should explain:
- what is wrong
- where it is wrong
- how to fix it

---

## 9. Advanced Mode Spec

### 9.1 Mental Model
Advanced mode is a real graph canvas.

It should behave like a professional node editor:
- visually explicit
- spatial
- inspectable
- directly manipulable

This is the mode closest to `n8n` and `ComfyUI`.

### 9.2 Canvas Layout
- infinite or large pannable canvas
- zoom controls
- minimap
- background grid
- node toolbar

### 9.3 Node Appearance
Each node is a rectangular card with:
- title
- node type
- short subtitle or purpose
- status badge
- left-side input ports
- right-side output ports

Optional node footer:
- warning count
- last run status
- output summary

### 9.4 Port Design
Ports must be visible and labeled.

Each port shows:
- port name
- data type or semantic type
- whether required or optional

Examples:
- input: `canon`
- input: `scenes`
- output: `shot_plan`
- output: `preview_job`

Port visibility is mandatory.
Users must not have to guess where connections start or end.

### 9.5 Creating a Node
Users create nodes by:
- clicking `Add Node`
- using a context menu on canvas
- dragging a node type from a library

New nodes should appear:
- near the current viewport center, or
- attached to the selected edge insertion point

### 9.6 Connecting Nodes
Users connect nodes by dragging from an output port to a compatible input port.

Connection behavior:
- highlight compatible destination ports
- dim incompatible ports
- show a preview line while dragging
- create the edge on release

Invalid connections should be blocked immediately.

Examples of blocked cases:
- output type does not match input type
- connection would create an illegal cycle
- input only allows one upstream source and is already occupied

### 9.7 Edge Appearance
Edges should:
- have clear direction
- visually attach to specific ports
- highlight on hover
- show error state when invalid

Optional labels:
- input mapping name
- condition name for branch edges

### 9.8 Selecting and Editing
Selecting a node opens the right-side inspector.

Inspector sections:
- summary
- inputs
- settings
- outputs
- validation
- execution history

Selecting an edge opens a lightweight edge inspector with:
- source
- destination
- mapping label if any
- condition metadata if any
- delete action

### 9.9 Auto Layout
Advanced mode should support:
- `Auto Arrange`
- `Fit to Screen`
- `Clean Up Selection`

Users should not have to manually tidy every graph after common edits.

### 9.10 Run Feedback on Graph
When a workflow runs:
- each node shows status color
- running node animates
- completed node shows success
- failed node shows error
- clicking a node reveals run details and outputs

This behavior should borrow from `n8n` rather than a static diagram.

---

## 10. Mapping Guided Mode to Advanced Mode
Guided mode and advanced mode must stay synchronized.

Mapping rules:
- each guided step maps to one node or a small known node group
- guided ordering maps to graph order
- guided branch controls map to specific edge patterns
- guided input selectors map to actual edge targets or workflow defaults

When a user switches from guided to advanced:
- preserve current selection if possible
- focus the corresponding node on the canvas

When a user switches from advanced to guided:
- preserve workflow data
- if the graph uses unsupported advanced constructs, show a notice such as:
  - `This workflow uses advanced branching. Guided mode can show it in read-only form.`

Guided mode should never silently destroy advanced graph structure.

---

## 11. Node Taxonomy
Nodes should be meaningful at the creative-production level, not low-level infrastructure level.

Recommended categories:
- Input
- Planning
- Generation
- Validation
- Assembly
- Export

Good node examples:
- `Extract Canon`
- `Generate Scenes`
- `Generate Shots`
- `Generate Character Visuals`
- `Validate Continuity`
- `Assemble Preview`
- `Create Final Export`

Avoid exposing node labels like:
- `HTTP Request`
- `JSON Transform`
- `Adapter Call`
- `Provider Invoke`

Those belong to the system internals, not the primary user UX.

---

## 12. Video Generation Node Library v1
After input nodes, the next important node family is reusable production nodes.

These nodes correspond to major video-generation components in the system.
They should be reusable building blocks that users can drag into different workflows to create different kinds of videos.

This means:
- a music video workflow and a storyboard workflow may reuse some of the same nodes
- the workflow editor should expose these as a node library, not hardcode them into one fixed pipeline
- users should compose video workflows from meaningful generation and assembly steps

### 12.1 Product Rule
These nodes should represent creative-production functions, not low-level model calls.

Good example:
- `Generate Video Clip`

Bad example:
- `Call Wan API`
- `Invoke ComfyUI JSON`
- `Run ffmpeg command`

Provider and adapter details belong inside node implementation, not in the node name the user sees.

### 12.2 Recommended Video-Oriented Node Groups

#### Input Nodes
- `Upload Video`
- `Upload Image`
- `Upload Audio`
- `Upload File`
- `Select Existing Asset`
- `Text Input`
- `Story Input`
- `Prompt Input`
- `Instructions Input`

#### Planning Nodes
- `Extract Canon`
- `Generate Scenes`
- `Generate Shot Plan`
- `Generate Storyboard`
- `Generate Narration Plan`
- `Generate Music Sync Plan`

#### Generation Nodes
- `Generate Image`
- `Generate Character Image`
- `Generate Background Plate`
- `Generate Video Clip`
- `Generate Motion Variant`
- `Generate Voice`
- `Generate Narration`
- `Generate Sound Bed`
- `Generate Captions`

#### Validation Nodes
- `Validate Continuity`
- `Validate Style`
- `Validate Duration`
- `Validate Caption Timing`
- `Validate Character Consistency`

#### Assembly Nodes
- `Assemble Sequence`
- `Assemble Timeline`
- `Add Audio Track`
- `Add Captions`
- `Build Preview Cut`

#### Export Nodes
- `Render Preview`
- `Render Final`
- `Create Social Cut`
- `Create Vertical Variant`

### 12.3 Reuse Model
The same nodes should be reusable across different workflow templates.

Example template compositions:

`Storyboard from Story`
- `Story Input`
- `Extract Canon`
- `Generate Scenes`
- `Generate Shot Plan`
- `Generate Storyboard`

`Short Video from Prompt`
- `Prompt Input`
- `Generate Shot Plan`
- `Generate Video Clip`
- `Assemble Sequence`
- `Render Preview`

`Music Video`
- `Upload Audio`
- `Prompt Input`
- `Generate Music Sync Plan`
- `Generate Video Clip`
- `Assemble Timeline`
- `Render Final`

`Narrated Story Video`
- `Story Input`
- `Generate Scenes`
- `Generate Narration`
- `Generate Image`
- `Assemble Timeline`
- `Add Audio Track`
- `Render Preview`

This is the core reason to model them as nodes:
- they can be reused
- they can be recombined
- they can support different output grammars without redesigning the whole app

### 12.4 Node Library UX
In advanced mode, the left node library or add-node menu should group these nodes by category:
- Inputs
- Planning
- Generation
- Validation
- Assembly
- Export

Each node entry should show:
- display name
- one-line purpose
- expected inputs
- expected outputs

Example:

`Generate Video Clip`
- Purpose: creates one or more video clips from prompts, scenes, or storyboard guidance
- Inputs: `prompt_text`, `scene`, `image_reference`, `style_reference`
- Outputs: `video_clip`

`Assemble Timeline`
- Purpose: arranges clips, audio, and captions into a structured output timeline
- Inputs: `video_clip`, `voice_track`, `music_track`, `captions`
- Outputs: `timeline`

### 12.5 Drag-and-Drop Authoring Rule
These reusable video nodes must be addable by drag and drop in advanced mode.

Expected flow:
1. user opens the node library
2. user drags `Generate Video Clip` onto the canvas
3. user drags `Render Preview` onto the canvas
4. user connects ports visually
5. user configures the selected node in the inspector

This should feel like assembling production components, not writing an internal graph schema.

### 12.6 Guided Mode Representation
In guided mode, these same nodes should usually appear as stage blocks rather than raw nodes.

Examples:
- `Generate Video Clip` may appear as `Create Clips`
- `Assemble Timeline` may appear as `Build Timeline`
- `Render Final` may appear as `Export Final Video`

So the same underlying node can have:
- a user-facing guided label
- a more explicit advanced-mode node label

Guided mode should hide technical complexity while still using the same reusable node model.

### 12.7 Config and Reusability
Each reusable node should expose only the configuration users actually need.

Example config for `Generate Video Clip`:
- prompt
- duration target
- style reference
- motion strength
- aspect ratio

Example config for `Render Final`:
- output format
- resolution
- frame rate
- audio mix preset

Advanced provider-specific config should stay behind an advanced section or adapter layer.

### 12.8 Asset-Based Outputs
Each node should output typed assets or typed references, not anonymous blobs.

Examples:
- `Generate Image` -> `image_asset`
- `Generate Video Clip` -> `video_clip_asset`
- `Generate Narration` -> `voice_asset`
- `Assemble Timeline` -> `timeline_asset`
- `Render Preview` -> `preview_asset` or `export_job`

This is what makes node reuse practical:
- downstream nodes can validate inputs
- workflows remain inspectable
- generated outputs can be versioned and reviewed

### 12.9 Initial Recommendation
For launch, the first reusable video node library should stay focused and opinionated.

Recommended first-pass set:
- `Story Input`
- `Prompt Input`
- `Upload Audio`
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

This is enough to support:
- storyboard generation
- prompt-to-video experiments
- narrated video assembly
- music video style flows

without overwhelming users with too many nodes on day one.

---

## 13. Connection Rules
The UI should enforce semantic connection rules.

Examples:
- `Extract Canon.output.canon` can connect to `Generate Scenes.input.canon`
- `Generate Scenes.output.scenes` can connect to `Generate Shots.input.scenes`
- `Generate Shots.output.shots` can connect to `Assemble Preview.input.shots`
- `Assemble Preview.output.output_version` can connect to `Create Export.input.output_version`

The UI should prevent:
- connecting output to output
- connecting input to input
- connecting incompatible asset types
- creating illegal loops in workflows that must remain acyclic

If advanced mode allows special cases later, those should be explicit and visually distinct.

---

## 14. Templates and Starter Flows
Templates are critical because they teach the workflow model.

Each template should show:
- a name
- a short use case
- expected inputs
- expected outputs
- stage preview

Template gallery cards should preview stages, not raw node ids.

Example:
`Storyboard from Story`
- Input: source story, canon
- Stages: Extract Canon -> Generate Scenes -> Generate Shots -> Render Preview
- Output: shot plan and preview

---

## 14. Empty States and Onboarding
Workflow onboarding must teach the product’s mental model.

Empty state for no workflow:
- explain what a workflow does in plain language
- offer recommended templates
- offer `Start with Guided Setup`
- hide advanced graph creation behind a secondary action

First-time helper content should explain:
- a workflow is a series of production steps
- each step uses inputs and creates outputs
- advanced mode shows the same workflow as a graph

Do not teach edges first.
Teach stages and outputs first.

---

## 15. Validation UX
Validation must be understandable at both the workflow and node levels.

Top-level validation summary:
- valid
- warnings
- blocking errors

Node-level validation:
- inline badges on step cards
- inline badges on graph nodes

Validation errors should support direct fix actions:
- `Select missing input`
- `Insert required step`
- `Connect to compatible output`
- `Use workflow default`

---

## 16. Approval and Freeze UX
Users must understand the difference between:
- editing a draft
- freezing a version
- approving a version
- running a version

Required cues:
- draft has unsaved/editable appearance
- frozen version is read-only
- approved version is clearly marked as runnable

When users try to edit a frozen version:
- offer `Duplicate as Draft`
- preserve trust in approved workflows

---

## 17. Execution Feedback UX
Users need confidence that the workflow is doing real work.

Show:
- current run status
- currently running node
- completed node count
- failed node details
- links to created assets

Node result inspection should be available from both:
- guided step cards
- advanced graph nodes

---

## 18. Recommended Default UX for This Product
For this product, the recommended launch behavior is:
- default to `Guided Mode`
- expose `Simple Mode` for lightweight users
- expose `Advanced Mode` as a power-user switch

This is the right balance because:
- the product is story/media-first
- most users will understand stages better than graphs
- advanced users still need exact control and debuggability

This product should not launch with:
- advanced graph as the default workflow experience
- manual edge editing as the primary authoring path
- node/edge JSON as the user-facing editor

---

## 19. Example Flow

### 19.1 Guided View
- Step 1: `Extract Canon`
- Step 2: `Generate Scenes`
- Step 3: `Generate Shots`
- Step 4: `Render Preview`

User actions:
- change canon extraction settings
- reorder `Render Preview` only if validation allows it
- insert `Validate Continuity` between scenes and shots
- run the workflow

### 19.2 Advanced View Representation
The same workflow appears as:
- `Extract Canon` -> `Generate Scenes` -> `Generate Shots` -> `Render Preview`

Each node shows:
- visible ports
- current status
- input and output labels

The user can:
- drag a new `Validate Continuity` node onto the canvas
- connect `Generate Scenes.output.scenes` to `Validate Continuity.input.scenes`
- connect `Validate Continuity.output.validated_scenes` to `Generate Shots.input.scenes`

That is the level of explicit graph interaction the current docs are missing.

---

## 20. Non-Goals for v1
- full freeform graph programming for all users
- arbitrary provider-level wiring as a mainstream workflow feature
- raw schema editing as the default editing surface
- complex merge-node logic unless required by a real workflow template
- exposing transport-level or adapter-level internals in the main UI

---

## 21. Implementation Notes
This is a UX spec, not a final technical implementation plan.

However, the following implications are intentional:
- guided mode should be backed by structured workflow operations, not JSON textareas
- advanced mode should use a real graph interaction model with visible ports and drag connections
- the existing raw node/edge JSON editing approach is not sufficient

If the app implements advanced graph editing in v1, it should behave like a modern node editor, not a form pretending to be a graph.
