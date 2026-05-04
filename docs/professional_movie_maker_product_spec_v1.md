# Professional Movie Maker Product Spec v1

## 1. Purpose
Define the product shape of this app as a professional AI-assisted movie-making system.

This document focuses on:
- page structure
- component hierarchy
- artifact model
- workflow/run model
- node inspector behavior
- review/versioning behavior

The goal is to make the app feel like a real production tool for filmmakers, not just a workflow demo or a collection of generation buttons.

---

## 2. Product Position
This app should feel like:
- a professional pre-production and editorial workspace
- a workflow-aware media production system
- a reviewable, versioned AI production pipeline

It should not feel like:
- a generic node playground
- a prompt toy
- a hidden automation system where users cannot inspect what happened

The product posture should be:
- story-first
- editorial-first
- workflow-capable
- traceable
- versioned

---

## 3. Core Product Principle
The product must separate three concerns clearly:

### 3.1 Pipeline Layer
Defines how content is produced.

Examples:
- story input
- scene generation
- shot planning
- image generation
- motion generation
- narration splitting
- TTS
- sound design
- timeline assembly
- export

This is represented as the workflow graph.

### 3.2 Editorial Layer
Defines where users do creative review and editing.

Examples:
- edit scenes
- edit shots
- replace images
- regenerate voice
- adjust timing
- sequence clips
- review outputs

This is represented as the main page and tab structure.

### 3.3 Inspection Layer
Defines how users understand what a workflow node, run, or asset actually did.

Examples:
- inspect inputs
- inspect outputs
- inspect prompts
- inspect errors
- rerun selectively
- compare versions

This is represented as the node inspector and run details UI.

Important rule:
- the workflow graph should not be overloaded with every generated item
- the editorial surfaces should not hide provenance

---

## 4. Primary User Mental Model
Professional users think in:
- story
- scenes
- shots
- images
- audio
- timeline
- review
- deliverables

They do not primarily think in:
- provider payloads
- hidden node outputs
- raw JSON

Therefore:
- the graph is for automation structure
- the pages are for creative work
- the inspector is for technical truth

---

## 5. Page Structure

### 5.1 Primary Navigation
The core left navigation should be:
- Project / Overview
- Workflows
- Sources
- Story & Canon
- Scenes
- Shots
- Timeline
- Review
- Activity

These pages should remain stable and recognizable.

### 5.2 Page Responsibilities

#### Project / Overview
Purpose:
- summarize project health and progress
- show current workflow, recent runs, asset counts, open review items, and latest output

Should contain:
- project metadata
- active workflow summary
- recent run summary
- scene/shot counts
- latest export status
- quick links into editorial pages

#### Workflows
Purpose:
- build and manage the automation graph

Should contain:
- workflow list
- workflow versions
- graph editor
- run controls
- workflow validation

Important:
- this page is for pipeline authoring, not detailed creative editing

#### Sources
Purpose:
- manage uploaded source files and references

Should contain:
- manuscripts
- PDFs
- images
- videos
- audio
- metadata and tags

#### Story & Canon
Purpose:
- hold the canonical source of truth for story, characters, setting, tone, and production rules

Should contain:
- story text
- canon notes
- character descriptions
- style notes
- generation constraints

#### Scenes
Purpose:
- review and edit scene-level planning outputs

Should contain:
- scene list
- scene summaries
- narration text at scene level where applicable
- per-scene approval and regeneration

#### Shots
Purpose:
- review and edit shot-level planning and media outputs

Should contain:
- shot list grouped by scene
- frame/image source control
- prompt editing
- voice-over and narration
- sound effects
- preview
- per-shot rerun and approval

#### Timeline
Purpose:
- sequence final clips, stills, audio, and transitions into an editorial timeline

Should contain:
- sequence tracks
- clip arrangement
- timing
- transitions
- preview player
- output sequence versions

#### Review
Purpose:
- collect all items requiring approval or comparison

Should contain:
- pending review items
- approved/rejected items
- side-by-side comparisons
- comments
- decision history

#### Activity
Purpose:
- show operational truth

Should contain:
- workflow runs
- node runs
- logs
- jobs
- exports
- errors

### 5.3 Design Rule for Pages
Pages should be organized by creative artifact and production activity, not by backend implementation details.

That keeps the product stable even when workflows evolve.

---

## 6. Component Hierarchy

### 6.1 App Shell
Top-level layout:
- top menu / toolbar
- left navigation
- main workspace
- right inspector
- bottom activity dock

### 6.2 Main Surfaces

#### Workflow Surface
Contains:
- workflow canvas
- workflow toolbar
- node library
- graph controls

#### Editorial Surfaces
Contains:
- list panel
- detail editor
- preview panel
- action toolbar

Examples:
- Scenes page
- Shots page
- Timeline page

#### Review Surface
Contains:
- pending/recently approved lists
- comparison viewer
- comments/actions panel

#### Activity Surface
Contains:
- runs table
- selected run details
- node run details
- export job status

### 6.3 Shared Components

#### Inspector Panel
Reusable for:
- workflow node
- scene
- shot
- clip
- asset
- output version

#### Media Preview Components
Reusable for:
- image
- audio
- video
- text
- JSON fallback

#### Version Compare Components
Reusable for:
- scene versions
- shot prompt versions
- image candidates
- audio versions
- timeline output versions

#### Candidate Picker Components
Reusable for:
- generated image candidates
- uploaded images
- reused project assets
- generated audio candidates

### 6.4 Hierarchy Rule
The user should always be able to move between:
- workflow structure
- artifact editing
- run inspection

without losing context.

---

## 7. Artifact Model

### 7.1 Core Principle
Everything important in the production pipeline should be treated as a versionable artifact.

Examples:
- source text
- canon
- scenes
- shot plans
- frame/image candidates
- narration segments
- voice-over audio
- sound effects
- timeline sequences
- final outputs

### 7.2 Required Artifact Properties
Every artifact should have:
- `id`
- `project_id`
- `artifact_type`
- `title`
- `status`
- `current_version_id`
- `approved_version_id` where applicable
- `created_at`
- `updated_at`

Every artifact version should have:
- `version_id`
- `artifact_id`
- `content`
- `source_mode`
- `workflow_run_id` if generated
- `node_run_id` if generated
- `assembled_from_asset_version_ids`
- `metadata`
- `created_at`

### 7.3 Key Artifact Types

#### Source Artifacts
- source_story
- reference_image
- reference_audio
- uploaded_video

#### Planning Artifacts
- canon
- scene
- scene_batch
- shot_plan
- narration_plan

#### Media Artifacts
- generated_image
- uploaded_image
- selected_frame
- video_segment
- narration_audio
- voice_over_audio
- sound_effect_audio
- music_track

#### Editorial Artifacts
- timeline_sequence
- output
- export

### 7.4 Candidate vs Active Selection
For key media artifacts, the system should support multiple candidates with one active selection.

Examples:
- a shot can have multiple image candidates
- a narration segment can have multiple audio candidates
- a video segment can have multiple render versions

The app should distinguish between:
- candidate
- active
- approved

### 7.5 Artifact Rule
Users should not lose previous generated content just because they selected an uploaded replacement.

Professional workflows require preservation of options.

---

## 8. Workflow and Run Model

### 8.1 Workflow Definition
Represents the editable graph.

Contains:
- nodes
- edges
- defaults
- metadata
- template type

Purpose:
- authoring
- experimentation
- branching

### 8.2 Workflow Version
Represents a frozen runnable snapshot of a workflow definition.

Contains:
- exact graph state
- version number
- validation state
- approval state
- graph hash

Purpose:
- reproducibility
- auditability
- approval before production use

### 8.3 Workflow Run
Represents one execution of a workflow version.

Contains:
- workflow version id
- project id
- run status
- progress
- input snapshots
- timestamps
- created artifacts summary

Purpose:
- execution history
- provenance
- rerun lineage

### 8.4 Node Run
Represents one execution of a single node in a workflow run.

Contains:
- node id
- node type
- effective configuration
- resolved inputs
- outputs
- logs
- status
- timing
- provider/model info

Purpose:
- debugging
- output inspection
- selective rerun

### 8.5 Selective Regeneration
The system should support:
- rerun this node
- rerun this scene
- rerun this shot
- regenerate only image/audio/video for a selected shot

This is critical for professional iteration speed.

### 8.6 Runtime Principle
The graph should remain stable.

Generated scenes and shots should not become permanent workflow-definition nodes.

Instead:
- they remain artifacts
- they are linked back to the node run that produced them
- they are inspectable from the node inspector and editorial surfaces

---

## 9. Node Inspector Spec

### 9.1 Purpose
The node inspector is the primary place to expose hidden workflow details without overcomplicating the graph.

It should open when a user selects a node.

### 9.2 Presentation
Preferred form:
- right-side inspector drawer for normal use

Optional:
- modal for deep inspection or full-screen review

### 9.3 Required Sections

#### Overview
Show:
- node title
- node type
- status
- last run status
- last run time
- output summary

#### Configuration
Show:
- editable node params
- defaults
- provider selection
- model/template choices

#### Inputs
Show:
- resolved inputs used in the latest selected run
- linked upstream artifacts
- raw input snapshots

#### Outputs
Show:
- typed output renderer
- preview or list of generated items
- raw JSON fallback

#### History
Show:
- past node runs
- prior outputs
- failure history

#### Actions
Show:
- rerun node
- regenerate selected output
- approve output
- open outputs in Scenes/Shots/Timeline/Review

### 9.4 Output Rendering Rules
The inspector should not default to raw JSON if a typed renderer exists.

Examples:
- scene output -> scene cards/list
- shot output -> shot list/cards
- image output -> image gallery
- audio output -> player
- video output -> player
- unknown output -> JSON viewer

### 9.5 Node Inspector Rule
This inspector is the main solution for exposing more detail to users without requiring dynamic tab creation for every node type.

---

## 10. Review and Versioning Spec

### 10.1 Core Principle
Professional users must be able to compare, approve, reject, and recover prior states.

Trust comes from versioning plus review.

### 10.2 Review Scope
Review should exist at multiple levels:
- workflow version
- scene
- shot
- image candidate
- audio candidate
- video segment
- final output

### 10.3 Required Review States
At minimum:
- draft
- pending_review
- approved
- rejected
- superseded

### 10.4 Review Actions
Users should be able to:
- approve current version
- reject current version
- compare against prior version
- comment on a version
- promote a candidate to active
- revert active to prior approved version

### 10.5 Compare Views
The product should support:
- text diff for story/canon/narration
- structured diff for scenes/shots
- image compare for frame candidates
- waveform/player compare for audio
- clip compare for video

### 10.6 Workflow Versioning
Workflow authoring must follow:
1. edit draft
2. validate
3. freeze version
4. approve version
5. run approved version

Important rule:
- approved workflow versions should be immutable

### 10.7 Artifact Versioning
Artifacts should support:
- creation of new version on edit
- viewing prior versions
- marking one version as current
- marking one version as approved

### 10.8 Review Page Role
The Review page is not the only place review happens, but it is the central aggregation surface.

It should collect:
- items pending approval
- recent approvals
- failed generations requiring human action
- version comparisons requiring decision

---

## 11. Professional UX Rules

### 11.1 Keep the Graph Semantic
The graph should show high-level automation structure, not every generated item.

### 11.2 Keep Editorial Surfaces First-Class
Scenes, shots, and timeline must feel like primary workspaces, not secondary outputs.

### 11.3 Preserve Provenance Everywhere
Users should always be able to answer:
- where did this come from
- which workflow run made it
- which node made it
- what input created it
- what changed between versions

### 11.4 Prefer Scoped Regeneration
Users should not need to rerun the full pipeline for every creative change.

### 11.5 Preserve Alternatives
Generated, uploaded, and reused media should coexist as candidates rather than replacing one another destructively.

### 11.6 Use Typed Review UI
Avoid showing JSON first when the content is something the user thinks of as a scene, shot, image, or audio asset.

---

## 12. Recommended MVP Priorities

### Phase 1
- stable page structure
- workflow graph
- scenes and shots editorial views
- node inspector
- basic artifact versioning
- run history

### Phase 2
- typed output renderers in node inspector
- candidate selection for images/audio
- selective rerun
- approval workflow
- review compare views

### Phase 3
- stronger timeline/editorial tools
- advanced approvals and comments
- branching from prior workflow versions
- batch operations across scenes/shots

---

## 13. Final Product Direction
The professional version of this app should be designed as:
- a workflow-driven production system
- an editorial workspace
- a versioned review system

The key balance is:
- **graph for automation**
- **pages for creative work**
- **inspector for truth**
- **review for trust**

If this balance is maintained, the app can scale to more complex workflows without becoming either:
- too technical for filmmakers
- or too opaque for professional production use
