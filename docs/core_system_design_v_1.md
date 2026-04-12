# Core System Design v1

## 1. Purpose
Design a story-to-media production system where AI can propose workflows, users can approve or edit them, and the system can execute them reproducibly.

This system is not just a content generator. It is a workflow-driven creative production platform.

---

## 2. Product Definition
A hybrid creative system for generating and editing media outputs from story-related inputs.

It supports:
- AI copilot for non-expert users
- manual workflow building for advanced users
- shared versioned assets
- reusable workflow templates
- reproducible execution through frozen workflow versions

The product should support multiple outputs from shared source material and shared canon.

---

## 3. Core Design Principles
1. AI should generate workflows, not just raw outputs.
2. Users must be able to inspect, edit, and approve important workflow decisions.
3. Approved workflows are frozen contracts, not living prompts.
4. Manual overrides always win.
5. All important assets and workflows are versioned.
6. Multiple outputs should reuse shared canon and core components.
7. Execution should be reproducible and auditable.
8. Drift should be reduced through explicit constraints, validation, and version control.
9. Workflow orchestration and creative editing are separate but connected layers.
10. The system should support both guided use and advanced customization.

---

## 4. System Scope
### Inputs
The system should support multiple source types:
- idea
- prose story
- screenplay or script fragment
- beat sheet
- storyboard text
- storyboard images
- lyrics
- narration notes
- music track
- mixed source pack

### Outputs
The system should support multiple output types:
- film
- music video
- short-form video
- audio story or novel audio
- teaser, trailer, or derivative cut later

---

## 5. Core Architecture Model
The system is organized into five layers.

### 5.1 Source Layer
Stores original user inputs and imported materials.

Examples:
- idea note
- story text
- script draft
- storyboard frames
- uploaded music track
- lyrics file

These are source assets and should be preserved for traceability.

### 5.2 Canon Layer
Stores the normalized creative truth extracted or authored from sources.

Examples:
- premise
- logline
- synopsis
- character bible
- environment bible
- beat sheet
- scene definitions
- continuity rules
- style rules

Canon is the shared creative foundation for all outputs.

### 5.3 Workflow Layer
Defines how the system transforms inputs and canon into production assets and exports.

Examples:
- extract canon from story
- generate scene plan
- generate shot plan
- generate narration
- validate continuity
- assemble timeline
- render output

Workflows are versioned and can be either AI-generated, template-generated, or user-authored.

### 5.4 Production Asset Layer
Stores media planning and generated production assets.

Examples:
- scene asset
- shot asset
- prompt asset
- storyboard frame
- image output
- video clip
- narration script
- caption track
- voice take
- music cue
- timeline segment

### 5.5 Output Layer
Stores output definitions and output-specific production plans.

Examples:
- film output package
- music video output package
- short-form vertical video output package
- audio story package
- export variants

Each output can share canon while having different assembly rules and media selections.

---

## 6. Separation of Concerns
The system must explicitly separate:

### Source
What the user provided.

### Canon
What is treated as the project truth.

### Workflow
How the system processes assets.

### Output
What format is being produced.

This separation is mandatory. It prevents architecture drift and avoids mixing user intent, story truth, and execution logic.

---

## 7. Workflow Model
### 7.1 Workflow Definition
An editable design for a workflow.

Contains:
- nodes
- edges
- parameters
- constraints
- model bindings
- execution settings
- validation steps

### 7.2 Workflow Version
A frozen snapshot of a workflow definition.

Once approved, a workflow version is immutable.

It freezes:
- graph structure
- node order
- prompts and templates
- model choices
- runtime parameters
- seed policy
- input asset versions
- locked constraints
- validation rules
- fallback rules

### 7.3 Workflow Run
A single execution instance of a workflow version.

Contains:
- start and end time
- run status
- resolved dynamic input snapshot
- logs
- outputs created
- errors
- machine or service metadata

One workflow definition can have many versions.
One workflow version can have many runs.

---

## 8. Workflow Lifecycle
Recommended lifecycle:
1. Draft
2. Test
3. Preview
4. Approve
5. Freeze
6. Run
7. Compare
8. Branch or revise
9. Deprecate

Rules:
- Approved workflows cannot be silently mutated.
- Any significant change creates a new workflow version.
- Re-runs must reference a specific workflow version.
- Re-runs should reuse the prior run's resolved dynamic inputs unless the user explicitly requests a refresh.
- Users should always be able to compare workflow versions.

---

## 9. Workflow as Contract
An approved workflow version is a contract.

This means:
- execution is based on explicit steps rather than hidden AI reasoning
- outputs are reproducible within defined tolerances
- any variation must be attributable to versioned changes in workflow, inputs, runtime, or model environment

Important clarification for v1:
- `asset_ref` and explicit approval-time inputs are pinned in the workflow version
- dynamic `asset_query` inputs are resolved into exact asset versions when a workflow run starts
- reruns should default to the original run snapshot, not silently re-query the project

The system should never treat a previously approved workflow as a loosely interpreted suggestion.

---

## 10. Determinism and Reproducibility
The system should support two execution modes.

### Deterministic Mode
Used when consistency matters most.

Characteristics:
- fixed seeds when supported
- locked prompts
- locked model versions
- locked parameters
- limited variance
- stronger validation

### Creative Variance Mode
Used when exploration matters more.

Characteristics:
- optional seed variation
- broader generation range
- more candidate outputs
- lower reproducibility guarantees

The user should always know which mode is active.

---

## 11. Drift Control Strategy
Workflow alone does not eliminate drift. Drift must be controlled at multiple levels.

### 11.1 Structural Drift
Examples:
- wrong scene order
- missing steps
- incorrect pipeline design

Controlled by:
- workflow templates
- explicit workflow graph
- user approval

### 11.2 Parameter Drift
Examples:
- prompt wording changes
- tone shifts
- style changes
- setting changes

Controlled by:
- parameter locking
- prompt versioning
- immutable workflow versions

### 11.3 Model Stochasticity
Examples:
- same prompt gives different output
- image variation
- LLM variability

Controlled by:
- seed policy
- temperature and sampling settings
- pinned model versions when possible
- tolerance-aware validation

---

## 12. Validation and Guardrails
Workflows may contain validation nodes or checkpoints.

Examples:
- continuity validation
- style validation
- duration validation
- missing asset check
- output format check
- caption alignment check
- narration timing check

Validation should be explicit, inspectable, and versioned as part of the workflow.

Guardrails should include:
- locked canon fields
- locked workflow constraints
- manual approval gates
- no silent overwrite of manual edits

---

## 13. Copilot Role
The copilot is primarily a planner and assistant, not an uncontrolled executor.

Responsibilities:
- interpret user intent
- propose workflows
- explain workflow decisions
- highlight risks or drift points
- suggest revisions
- propose patches to assets or workflows

The copilot may auto-generate workflow drafts, but important workflow changes should be reviewable before execution.

---

## 14. Advanced User Role
Experienced users should be able to:
- create workflows manually
- edit graph structure
- insert or remove nodes
- swap models or services
- branch workflows
- save templates
- create custom output pipelines

Advanced control should operate on the same underlying workflow engine.

---

## 15. Workflow Template Strategy
The system should define reusable templates instead of separate product silos.

Examples:
- film template
- music video template
- short-form narration template
- audio story template

Templates are composed from shared nodes and services.

This avoids building separate studios while still supporting different output grammars.

---

## 16. Node Design Principles
Nodes should be meaningful at the creative-production level.

Avoid overly low-level nodes in v1.

### Good node examples
- ingest source
- parse story
- extract canon
- generate beat sheet
- generate scenes
- generate shot plan
- generate narration
- generate captions
- sync to music
- generate images
- generate video clips
- validate continuity
- assemble timeline
- render preview
- render final

### Node categories
- input nodes
- planning nodes
- generation nodes
- validation nodes
- assembly nodes
- export nodes

Nodes should operate on project assets and asset references, not anonymous blobs.

---

## 17. Asset Model Principles
All important entities should be versioned and traceable.

Recommended asset classes:
- source assets
- canon assets
- production assets
- output assets
- workflow assets

Examples:
- source_story
- character_bible
- continuity_rule
- scene
- shot
- prompt
- image_output
- video_clip
- narration_script
- voice_take
- caption_track
- output_definition
- workflow_definition
- workflow_version

---

## 18. Output Model
A single project may produce multiple outputs.

Each output should include:
- output type
- source and canon references
- workflow reference
- output settings
- platform settings
- aspect ratio
- duration target
- captions on or off
- music on or off
- narration on or off
- timeline or assembly plan
- export variants

Outputs share canon but may use different production assets and assembly logic.

---

## 19. Project Model
A project is the top-level container that links:
- sources
- canon
- workflows
- production assets
- outputs
- versions
- comments and approvals
- runs and logs

One project may contain multiple workflows and multiple outputs.

---

## 20. Core Storage Requirements
### Metadata storage
Use SQLite first, optionally Postgres later.

Suggested entities:
- projects
- assets
- asset_versions
- asset_links
- workflows
- workflow_versions
- workflow_runs
- outputs
- output_versions
- approvals
- comments
- jobs
- generations
- validation_results

### File storage
Per-project structured storage for:
- images
- video
- audio
- references
- exports
- thumbnails
- workflow snapshots if needed

---

## 21. Runtime and Environment Versioning
For reproducibility, the system should store not only the workflow and assets, but also important runtime information.

Examples:
- model version or checksum
- service version
- node or plugin version
- renderer version
- ffmpeg version
- workflow engine version
- machine or device info where relevant

This is especially important when local model stacks are used.

---

## 22. Trust Model
The trust model of the system is based on:
- visible workflows
- versioned assets
- explicit approval
- immutable workflow versions
- traceable reruns
- explainable validation
- manual override precedence

The product promise should be framed as:
- reproducible
- inspectable
- auditable
- controllable

Not as magical or perfectly deterministic in all cases.

---

## 23. Non-Goals for v1
- full low-level graph editing for all users by default
- perfect determinism across every model backend
- fully autonomous execution without user oversight
- replacing manual editing
- solving every possible creative workflow in v1
- exposing deeply technical node details to non-expert users

---

## 24. Recommended Initial Implementation Focus
### Phase 1
- core asset model
- source/canon/workflow/output separation
- workflow schema v1
- workflow lifecycle and versioning
- copilot workflow proposal flow
- deterministic execution settings
- basic validation hooks

### Phase 2
- reusable workflow templates
- multiple outputs per project
- advanced asset linking
- workflow comparison tools
- output branching

### Phase 3
- advanced manual workflow builder
- template library
- richer validation and policy engine
- collaboration and sharing

---

## 25. Product Positioning
This product is best described as:

A story-to-media production workspace where AI proposes workflows, humans approve the logic, and the system executes creative pipelines reproducibly across multiple output formats.

Short positioning:

AI that plans the pipeline, humans approve the logic, and the system executes it reproducibly.

---

## 26. Workflow Schema v1

### 26.1 Goals
The workflow schema must:
- be simple enough to implement early
- support AI-generated and user-authored workflows
- freeze reproducible execution details
- reference versioned project assets
- support validation, branching, and reruns later

The schema should model creative-production workflows, not low-level compute graphs.

---

### 26.2 Core Objects
The minimum workflow schema should define three persisted objects:

#### WorkflowDefinition
Editable workflow draft.

#### WorkflowVersion
Frozen snapshot approved for execution.

#### WorkflowRun
Execution instance of a specific workflow version.

---

### 26.3 WorkflowDefinition Shape
Suggested shape:

```json
{
  "id": "wf_def_001",
  "project_id": "proj_001",
  "title": "Short Film Draft Workflow",
  "description": "Generates a short film preview from approved canon and scenes.",
  "mode": "guided",
  "status": "draft",
  "template_type": "film",
  "created_by": "copilot",
  "created_at": "2026-04-10T10:00:00Z",
  "updated_at": "2026-04-10T10:15:00Z",
  "nodes": [],
  "edges": [],
  "defaults": {},
  "metadata": {}
}
```

Field notes:
- `mode`: simple, guided, advanced
- `status`: draft, testing, approved, deprecated
- `template_type`: film, music_video, short_form_video, audio_story, custom
- `nodes`: ordered node definitions
- `edges`: explicit graph links
- `defaults`: shared workflow-level defaults

---

### 26.4 Node Schema
Each node should be meaningful at the creative-production level.

Suggested shape:

```json
{
  "id": "node_generate_shots",
  "type": "generate_shot_plan",
  "title": "Generate Shot Plan",
  "description": "Create shot assets from approved scenes.",
  "enabled": true,
  "inputs": {
    "scene_ids": {
      "source": "asset_query",
      "value": {
        "asset_type": "scene",
        "approval_state": "approved"
      }
    }
  },
  "outputs": {
    "shot_ids": {
      "asset_type": "shot"
    }
  },
  "config": {
    "shots_per_scene_target": 5,
    "camera_style": "cinematic",
    "duration_bias": "short"
  },
  "constraints": {
    "preserve_canon_fields": ["character_identity", "environment", "wardrobe"],
    "locked": true
  },
  "model_binding": {
    "provider": "ollama",
    "model": "qwen3:8b",
    "model_version": "qwen3:8b@local",
    "temperature": 0.2,
    "top_p": 0.9
  },
  "execution": {
    "retry_policy": "fail_fast",
    "timeout_sec": 180,
    "seed_mode": "fixed",
    "seed": 128493
  },
  "validation": {
    "on_success": "continue",
    "on_warn": "continue_with_warning",
    "on_fail": "stop"
  },
  "metadata": {}
}
```

Required node fields in v1:
- `id`
- `type`
- `enabled`
- `inputs`
- `outputs`
- `config`
- `execution`

Optional but strongly recommended:
- `constraints`
- `model_binding`
- `validation`
- `title`
- `description`

---

### 26.5 Edge Schema
Edges define execution dependencies and optional data routing.

Suggested shape:

```json
{
  "id": "edge_01",
  "from": "node_generate_scenes",
  "to": "node_generate_shots",
  "condition": "always"
}
```

Optional future fields:
- branch conditions
- pass/warn/fail routing
- output-handle to input-handle mapping

For v1, simple dependency edges are enough.

---

### 26.6 Input Reference Model
Nodes should not pass anonymous blobs by default.
They should pass asset references, asset queries, or explicit literals.

Supported input source types for v1:
- `literal`
- `asset_ref`
- `asset_query`
- `node_output`
- `workflow_default`

Example:

```json
{
  "source": "asset_ref",
  "value": {
    "asset_id": "scene_03",
    "version": 4
  }
}
```

Example query:

```json
{
  "source": "asset_query",
  "value": {
    "asset_type": "scene",
    "approval_state": "approved",
    "scene_group": "act_2"
  }
}
```

Resolution rules for v1:
- `literal`, `asset_ref`, and `workflow_default` are stable by definition
- `asset_query` expresses a selection policy in the workflow version, not a pre-expanded result set
- when a run starts, every `asset_query` must resolve to exact asset version ids and be persisted in the workflow run
- node outputs created earlier in the same run are resolved and persisted in the corresponding node run
- reruns must reuse the stored run snapshot by default; refreshing dynamic queries must be explicit

This is important for traceability and reruns.

---

### 26.7 Output Declaration Model
Each node should declare what it is expected to create or update.

Supported output patterns in v1:
- create asset
- update asset
- create asset set
- create validation result
- create export job

Example:

```json
{
  "shot_ids": {
    "asset_type": "shot",
    "cardinality": "many",
    "operation": "create"
  }
}
```

---

### 26.8 Workflow Defaults
Workflow-level defaults reduce repeated settings.

Suggested shape:

```json
{
  "execution_mode": "deterministic",
  "default_seed_mode": "fixed",
  "default_temperature": 0.2,
  "aspect_ratio": "16:9",
  "captions": false,
  "music": true,
  "narration": false,
  "continuity_profile": "strict",
  "output_type": "film"
}
```

Node-level settings override workflow defaults.

---

### 26.9 WorkflowVersion Shape
A workflow version freezes the exact contract used for execution.

Suggested shape:

```json
{
  "id": "wf_ver_012",
  "workflow_definition_id": "wf_def_001",
  "project_id": "proj_001",
  "version_number": 12,
  "status": "approved",
  "approved_by": "user",
  "approved_at": "2026-04-10T11:00:00Z",
  "graph_hash": "abc123hash",
  "template_type": "film",
  "frozen_workflow": {
    "nodes": [],
    "edges": [],
    "defaults": {}
  },
  "input_asset_versions": {
    "canon_synopsis": {
      "asset_id": "synopsis_01",
      "version": 3
    },
    "character_bible": {
      "asset_id": "char_bible_01",
      "version": 7
    }
  },
  "runtime_environment": {
    "workflow_engine_version": "1.0.0",
    "ffmpeg_version": "7.0",
    "services": {
      "llm": "local-llm-service@1.2.0",
      "image": "comfy-service@0.9.1",
      "video": "video-service@0.4.0"
    }
  },
  "notes": "Approved preview version for internal test."
}
```

Fields that must be frozen in v1:
- graph structure
- node configs
- model bindings
- execution params
- seed policy
- workflow defaults
- approval-time input asset versions
- input resolution policy
- validation rules
- runtime environment summary

---

### 26.10 WorkflowRun Shape
Suggested shape:

```json
{
  "id": "wf_run_204",
  "workflow_version_id": "wf_ver_012",
  "project_id": "proj_001",
  "status": "running",
  "triggered_by": "user",
  "rerun_of_workflow_run_id": null,
  "started_at": "2026-04-10T11:05:00Z",
  "ended_at": null,
  "resolved_input_snapshot": {
    "node_generate_shots.scene_ids": ["scene_01:v2", "scene_02:v1"]
  },
  "node_runs": [],
  "outputs": [],
  "logs": [],
  "warnings": [],
  "errors": []
}
```

---

### 26.11 NodeRun Shape
Each node execution should have its own run record.

```json
{
  "id": "node_run_01",
  "node_id": "node_generate_shots",
  "status": "completed",
  "started_at": "2026-04-10T11:06:00Z",
  "ended_at": "2026-04-10T11:06:45Z",
  "resolved_inputs": {
    "scene_ids": ["scene_01:v2", "scene_02:v1"]
  },
  "effective_config": {
    "shots_per_scene_target": 5,
    "camera_style": "cinematic"
  },
  "effective_model_binding": {
    "provider": "ollama",
    "model": "qwen3:8b"
  },
  "seed": 128493,
  "created_outputs": ["shot_101:v1", "shot_102:v1"],
  "warnings": [],
  "errors": []
}
```

This is important for debugging and rerun traceability.

---

### 26.12 Validation Result Shape
Validation should be a first-class output.

```json
{
  "id": "val_001",
  "node_id": "node_validate_continuity",
  "status": "warn",
  "rule_results": [
    {
      "rule": "preserve_face_identity",
      "status": "pass"
    },
    {
      "rule": "wardrobe_match",
      "status": "warn",
      "message": "Jacket color shifted from canon brown to olive."
    }
  ],
  "summary": "Continuity mostly preserved with one wardrobe mismatch.",
  "created_at": "2026-04-10T11:07:00Z"
}
```

Allowed validation statuses in v1:
- pass
- warn
- fail

---

### 26.13 Minimum Node Types for v1
Recommended initial node set:

#### Input nodes
- ingest_source
- parse_story
- import_music

#### Planning nodes
- extract_canon
- generate_beat_sheet
- generate_scenes
- generate_shot_plan
- generate_narration
- generate_captions
- generate_music_sync_plan

#### Generation nodes
- generate_image
- generate_video_clip
- generate_voice

#### Validation nodes
- validate_continuity
- validate_style
- validate_duration
- validate_caption_timing

#### Assembly nodes
- assemble_timeline
- render_preview
- render_final

---

### 26.14 Execution Rules for v1
1. Execution is based on dependency order from edges.
2. Disabled nodes are skipped.
3. If a node fails and `on_fail` is `stop`, the workflow run stops.
4. If a node warns and `on_warn` is `continue_with_warning`, execution continues.
5. Node inputs are resolved at runtime and recorded in the node run.
6. Effective config equals workflow defaults plus node overrides.
7. Approved workflow versions are immutable.
8. Any material workflow edit creates a new workflow version.

---

### 26.15 Approval Rules for v1
A workflow version may be approved only if:
- all required nodes are valid
- all references resolve successfully
- model bindings are explicit
- execution mode is declared
- seed policy is declared
- required input asset versions are pinned
- validation behavior is declared for validation-capable nodes

---

### 26.16 Example Film WorkflowDefinition
```json
{
  "id": "wf_def_film_01",
  "project_id": "proj_001",
  "title": "Film Preview Workflow",
  "mode": "guided",
  "status": "draft",
  "template_type": "film",
  "defaults": {
    "execution_mode": "deterministic",
    "aspect_ratio": "16:9",
    "captions": false,
    "music": true,
    "narration": false,
    "continuity_profile": "strict"
  },
  "nodes": [
    {
      "id": "node_extract_canon",
      "type": "extract_canon",
      "enabled": true,
      "inputs": {
        "source_story": {
        "source": "asset_query",
        "value": {
          "asset_type": "source_story",
          "approval_state": "approved"
        }
      }
      },
      "outputs": {
        "canon_assets": {
          "asset_type": "canon_asset",
          "cardinality": "many",
          "operation": "create"
        }
      },
      "config": {},
      "execution": {
        "retry_policy": "fail_fast",
        "timeout_sec": 180,
        "seed_mode": "fixed",
        "seed": 1001
      }
    },
    {
      "id": "node_generate_scenes",
      "type": "generate_scenes",
      "enabled": true,
      "inputs": {
        "canon_assets": {
          "source": "node_output",
          "value": {
            "node_id": "node_extract_canon",
            "output_key": "canon_assets"
          }
        }
      },
      "outputs": {
        "scene_ids": {
          "asset_type": "scene",
          "cardinality": "many",
          "operation": "create"
        }
      },
      "config": {
        "target_scene_count": 8
      },
      "execution": {
        "retry_policy": "fail_fast",
        "timeout_sec": 180,
        "seed_mode": "fixed",
        "seed": 1002
      }
    },
    {
      "id": "node_generate_shots",
      "type": "generate_shot_plan",
      "enabled": true,
      "inputs": {
        "scene_ids": {
          "source": "node_output",
          "value": {
            "node_id": "node_generate_scenes",
            "output_key": "scene_ids"
          }
        }
      },
      "outputs": {
        "shot_ids": {
          "asset_type": "shot",
          "cardinality": "many",
          "operation": "create"
        }
      },
      "config": {
        "shots_per_scene_target": 5
      },
      "constraints": {
        "preserve_canon_fields": ["character_identity", "environment", "wardrobe"]
      },
      "execution": {
        "retry_policy": "fail_fast",
        "timeout_sec": 240,
        "seed_mode": "fixed",
        "seed": 1003
      }
    },
    {
      "id": "node_render_preview",
      "type": "render_preview",
      "enabled": true,
      "inputs": {
        "shot_ids": {
          "source": "node_output",
          "value": {
            "node_id": "node_generate_shots",
            "output_key": "shot_ids"
          }
        }
      },
      "outputs": {
        "preview_job": {
          "asset_type": "export_job",
          "cardinality": "one",
          "operation": "create"
        }
      },
      "config": {
        "preview_quality": "draft"
      },
      "execution": {
        "retry_policy": "fail_fast",
        "timeout_sec": 600,
        "seed_mode": "fixed",
        "seed": 1004
      }
    }
  ],
  "edges": [
    {
      "id": "edge_01",
      "from": "node_extract_canon",
      "to": "node_generate_scenes",
      "condition": "always"
    },
    {
      "id": "edge_02",
      "from": "node_generate_scenes",
      "to": "node_generate_shots",
      "condition": "always"
    },
    {
      "id": "edge_03",
      "from": "node_generate_shots",
      "to": "node_render_preview",
      "condition": "always"
    }
  ],
  "metadata": {}
}
```

---

### 26.17 Open Design Questions
1. Should workflow schema support branch merge nodes in v1 or later?
2. Should asset queries support richer filters at launch or be kept minimal?
3. How should node typing map to backend service adapters?
4. What is the best graph hash strategy for change detection?
5. Which workflow fields should be user-editable in guided mode vs advanced mode?
6. How should partial reruns work when only downstream nodes need refresh?
7. Should fallback model bindings be part of v1 or added later?
8. What minimum validation node set is required before approval?

---

## 27. Asset Schema and Link Model v1

### 27.1 Goals
The asset model must:
- represent all important creative and production objects as versioned assets
- separate source, canon, production, workflow, and output concerns
- support manual editing and automated generation on the same objects
- make propagation and traceability explicit
- allow workflows to reference exact asset versions
- make downstream impact analysis possible

The asset model is the persistent creative state of the system.

---

### 27.2 Asset Categories
Recommended first-class categories:

#### Source Assets
Original user-provided or imported materials.

Examples:
- source_idea
- source_story
- source_script
- source_storyboard_text
- source_storyboard_image
- source_lyrics
- source_music
- source_notes

#### Canon Assets
Normalized project truth.

Examples:
- premise
- logline
- synopsis
- beat_sheet
- character_bible
- environment_bible
- style_bible
- continuity_rule
- scene_definition

#### Production Assets
Planning and generated assets used to produce outputs.

Examples:
- scene
- shot
- prompt
- storyboard_frame
- narration_script
- dialogue_line
- image_output
- video_clip
- voice_take
- caption_track
- music_cue
- timeline_segment
- validation_result

#### Workflow Assets
Execution design and history.

Examples:
- workflow_definition
- workflow_version
- workflow_run
- node_run

#### Output Assets
Output-specific packages and render artifacts.

Examples:
- output_definition
- output_cut
- export_job
- export_file

---

### 27.3 Common Asset Schema
All assets should share a common envelope.

Suggested base schema:

```json
{
  "id": "shot_012",
  "project_id": "proj_001",
  "asset_type": "shot",
  "asset_category": "production",
  "title": "Allan checks remaining ammunition",
  "status": "needs_revision",
  "version": 4,
  "parent_asset_id": "shot_012",
  "previous_version_id": "shot_012_v3",
  "created_by": "system",
  "edited_by_last": "user",
  "source_mode": "workflow",
  "workflow_version_id": "wf_ver_012",
  "workflow_run_id": "wf_run_204",
  "content": {},
  "metadata": {},
  "locked_fields": [],
  "approval": {
    "state": "unapproved",
    "approved_by": null,
    "approved_at": null
  },
  "timestamps": {
    "created_at": "2026-04-10T11:00:00Z",
    "updated_at": "2026-04-10T11:05:00Z"
  }
}
```

Required common fields in v1:
- `id`
- `project_id`
- `asset_type`
- `asset_category`
- `status`
- `version`
- `content`
- `metadata`
- `timestamps`

Strongly recommended:
- `parent_asset_id`
- `previous_version_id`
- `created_by`
- `edited_by_last`
- `source_mode`
- `workflow_version_id`
- `workflow_run_id`
- `locked_fields`
- `approval`

---

### 27.4 Asset Status Model
Suggested statuses for v1:
- draft
- needs_revision
- ready
- locked
- deprecated
- failed

Interpretation:
- `draft`: newly created or in progress
- `needs_revision`: known issue or pending user update
- `ready`: operationally usable but not necessarily review-approved
- `locked`: frozen against automatic change
- `deprecated`: superseded but retained
- `failed`: generation or parsing failed

---

### 27.5 Source Mode
`source_mode` indicates how the asset version was created.

Allowed values in v1:
- manual
- copilot
- workflow
- import
- system

This improves traceability and user trust.

---

### 27.6 Asset Type-Specific Content Shapes
Different asset types may define their own `content` schema.

#### Example: Character Bible
```json
{
  "name": "Allan",
  "appearance": {
    "age_range": "22-28",
    "face": "lean angular face, piercing blue eyes, dark hair",
    "body": "athletic, lean",
    "wardrobe": "worn earth-tone survival shirt, dusty trousers"
  },
  "traits": ["resourceful", "tense", "determined"],
  "voice_profile": "calm under pressure",
  "canon_locks": ["face", "wardrobe"]
}
```

#### Example: Scene
```json
{
  "scene_number": 3,
  "title": "Ammunition Check in the Grass",
  "purpose": "Show tension and scarcity",
  "conflict": "Allan may be running out of ammunition while under threat.",
  "emotional_change": "calm focus to rising concern",
  "duration_target_sec": 18,
  "setting_ref": "env_bible_01:v4",
  "character_refs": ["char_allan:v7"],
  "notes": "Should feel quiet before renewed violence."
}
```

#### Example: Shot
```json
{
  "scene_ref": "scene_03:v2",
  "title": "Allan checks remaining ammunition",
  "purpose": "Show scarcity and danger",
  "prompt": "Close-up of Allan lying in dry grass, touching the AK-47 magazine, checking remaining rounds.",
  "negative_prompt": "extra hands, duplicated weapon, face drift",
  "camera": {
    "shot_type": "close_up",
    "angle": "low_side_angle",
    "motion": "subtle_handheld"
  },
  "duration_sec": 4,
  "continuity_refs": ["char_allan:v7", "env_savanna:v3"],
  "latest_media_refs": {
    "image": "img_225:v1",
    "video": null
  }
}
```

---

### 27.7 Asset Versioning Rules
Important rule:
- each saved change creates a new asset version for important asset types
- versions are immutable after creation
- the newest version does not overwrite older history

Recommended versioning approach:
- stable asset family id
- version number per family
- explicit pointer to previous version

Example:
- `scene_03` is the family
- `scene_03:v1`, `scene_03:v2`, `scene_03:v3` are versions

This can be implemented with either separate rows per version or an assets table plus asset_versions table.

---

### 27.8 Approval Rules for Assets
Assets may be approved independently of workflows.

Suggested approval states:
- unapproved
- approved
- rejected

Rules:
- approved canon assets may be used as pinned workflow inputs
- approved scenes and shots are stronger candidates for downstream use
- workflows should not silently mutate approved assets unless user explicitly chooses update scope
- `status` describes lifecycle and operability; `approval.state` describes review decision
- workflow and UI queries that mean "review-approved" should filter on `approval_state`, not `status`
- each asset family should track both the current working version and the current approved version

---

### 27.9 Locking Rules
Assets and fields may be locked.

Two lock scopes:

#### Asset-level lock
Prevents automatic modification of the entire asset.

#### Field-level lock
Prevents automatic modification of selected fields.

Examples:
- lock character face description
- lock wardrobe
- lock environment identity
- lock narration script

Suggested `locked_fields` examples:
- `content.appearance.face`
- `content.camera`
- `content.prompt`

Manual edits may still be allowed depending on policy.

---

### 27.10 Asset Links
Links connect assets and make dependency and propagation explicit.

Suggested link schema:

```json
{
  "id": "link_001",
  "project_id": "proj_001",
  "from_asset": {
    "asset_id": "scene_03",
    "version": 2
  },
  "to_asset": {
    "asset_id": "shot_012",
    "version": 4
  },
  "link_type": "contains",
  "strength": "strong",
  "created_by": "system",
  "metadata": {}
}
```

Required fields in v1:
- `from_asset`
- `to_asset`
- `link_type`

Recommended:
- `strength`
- `created_by`
- `metadata`

---

### 27.11 Core Link Types for v1
Recommended minimum set:

#### Structural links
- `contains`
- `ordered_before`
- `belongs_to_output`

#### Derivation links
- `derived_from`
- `generated_from`
- `revised_from`

#### Reference links
- `references_character`
- `references_environment`
- `references_style`
- `references_continuity_rule`
- `references_music`

#### Execution links
- `produced_by_workflow_version`
- `produced_by_workflow_run`
- `validated_by`

#### Media links
- `has_preview`
- `has_final_media`
- `uses_voice_take`
- `uses_caption_track`

This set is enough to support traceability and impact analysis in v1.

---

### 27.12 Link Strength
`strength` helps propagation decisions.

Allowed values:
- strong
- weak
- advisory

Interpretation:
- `strong`: likely affected by upstream changes
- `weak`: may be affected
- `advisory`: informational only

Example:
- scene to shot via `contains` is usually `strong`
- style reference may be `weak`
- note reference may be `advisory`

---

### 27.13 Propagation Model
When an upstream asset changes, the system should use asset links to determine impact.

Propagation scopes:
- only this asset
- this asset and directly linked downstream assets
- all linked assets in current scene
- all linked assets in current output
- all linked assets in project

Propagation should never happen silently for important approved assets.

The system should be able to answer:
- what depends on this asset?
- what outputs are impacted?
- what can be safely rerun?

---

### 27.14 Asset Query Model
Workflows and UI should be able to query assets by structured filters.

Suggested filter dimensions:
- asset_type
- asset_category
- status
- approval_state
- scene number or group
- output membership
- created_by
- source_mode
- tags

Example query object:

```json
{
  "asset_type": "shot",
  "approval_state": "approved",
  "scene_number": 3,
  "tags": ["act_2", "preview_ready"]
}
```

This should stay intentionally simple in v1.

---

### 27.15 Output Membership Model
Outputs should not duplicate canon assets by default.

Instead, outputs should reference selected assets.

Example:
- output_definition references canon assets, scene assets, shot assets, narration, music, and timeline assets
- output_cut references the concrete selected versions used in one cut

This supports multiple outputs sharing the same canon while having different assemblies.

---

### 27.16 Suggested OutputDefinition Shape
```json
{
  "id": "output_01",
  "project_id": "proj_001",
  "asset_type": "output_definition",
  "asset_category": "output",
  "title": "Film Preview Output",
  "status": "draft",
  "version": 1,
  "content": {
    "output_type": "film",
    "workflow_version_ref": "wf_ver_012",
    "settings": {
      "aspect_ratio": "16:9",
      "duration_target_sec": 120,
      "captions": false,
      "music": true,
      "narration": false
    },
    "asset_refs": {
      "canon": ["synopsis_01:v3", "char_bible_01:v7"],
      "scenes": ["scene_01:v2", "scene_02:v1"],
      "shots": ["shot_101:v1", "shot_102:v1"],
      "timeline": ["timeline_01:v1"]
    }
  },
  "metadata": {},
  "locked_fields": [],
  "approval": {
    "state": "unapproved",
    "approved_by": null,
    "approved_at": null
  },
  "timestamps": {
    "created_at": "2026-04-10T12:00:00Z",
    "updated_at": "2026-04-10T12:00:00Z"
  }
}
```

---

### 27.17 Timeline and Media Asset Rules
Timeline and media assets should be first-class assets, not hidden render artifacts.

Recommended rules:
- `timeline_segment` assets store timeline structure
- `image_output`, `video_clip`, `voice_take`, and `export_file` assets store media metadata and file paths
- binary media files live in file storage, but metadata lives in asset records
- media assets should reference the workflow run that produced them

---

### 27.18 Validation Result as Asset
Validation output should exist both as runtime result and persistent asset when important.

Why:
- allows UI review
- allows approval workflows
- allows historical comparison
- allows a shot or output to carry known warnings

Suggested use cases:
- continuity check result
- caption timing result
- duration warning result
- style mismatch report

---

### 27.19 Recommended Database Entities
For v1, suggested core entities are:
- projects
- assets
- asset_versions
- asset_links
- workflows
- workflow_versions
- workflow_runs
- node_runs
- approvals
- comments
- jobs
- generations
- validation_results

A practical implementation is:
- `assets` for stable family metadata
- `asset_versions` for immutable content snapshots
- `asset_links` for dependency graph

---

### 27.20 Example Link Graph for Film Project
Example relationships:
- `source_story` -> `synopsis` via `derived_from`
- `synopsis` -> `scene_03` via `generated_from`
- `scene_03` -> `shot_012` via `contains`
- `shot_012` -> `char_allan` via `references_character`
- `shot_012` -> `env_savanna` via `references_environment`
- `shot_012` -> `img_225` via `has_preview`
- `img_225` -> `wf_run_204` via `produced_by_workflow_run`
- `output_01` -> `shot_012` via `belongs_to_output`

This gives you impact analysis and traceability.

---

### 27.21 Asset and Workflow Boundary Rule
The system must keep this boundary clear:

- assets store creative state and media state
- workflows store transformation logic
- workflow runs store execution history
- links connect dependencies across all of them

This boundary is foundational and should not be blurred.

---

### 27.22 Open Design Questions
1. Should all asset versions be immutable rows, or should some lightweight draft edits remain mutable until save?
2. What asset types must be families with deep history in v1?
3. Which link types should trigger strong propagation by default?
4. Should outputs reference asset versions directly or use cut manifests for final packaging?
5. How should tags and labels be standardized across assets?
6. What is the minimum metadata required for media file records?
7. Should validation results always be promoted to assets or only when persisted by user or policy?
8. How should manual edits to workflow-generated assets preserve provenance without cluttering history?
