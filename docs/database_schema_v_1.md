# Database Schema v1

## 1. Purpose
Define the initial persistent data model for the story-to-media production system.

This schema must support:
- versioned assets
- workflow definitions and frozen workflow versions
- workflow runs and node runs
- asset links and propagation
- outputs and exports
- approvals, comments, validation results, and jobs

The design should work well with SQLite first and remain migratable to Postgres later.

---

## 2. Design Principles
1. Immutable history for important versions
2. Stable family records plus version snapshots
3. Explicit links instead of hidden foreign-key assumptions where flexibility matters
4. Clear separation between creative state, execution state, and storage metadata
5. Queryability for project views, impact analysis, reruns, and audit trails

---

## 3. Recommended Entity Groups

### Project scope
- projects

### Asset scope
- assets
- asset_versions
- asset_links
- asset_tags

### Event and observability
- project_events

### Workflow scope
- workflow_definitions
- workflow_versions
- workflow_runs
- node_runs

### Output scope
- outputs
- output_versions
- export_jobs

### Review and governance
- approvals
- comments
- validation_results

### Jobs and generation tracking
- jobs
- generation_records
- service_calls

### File metadata
- file_records

---

## 4. Projects

### Table: projects
Stores the top-level project container.

Suggested columns:
- id TEXT PRIMARY KEY
- title TEXT NOT NULL
- description TEXT
- status TEXT NOT NULL
- primary_output_type TEXT
- created_by TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- archived_at TEXT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'

Notes:
- `status` example values: active, archived, deleted
- `metadata_json` can store project preferences and environment defaults

Suggested indexes:
- idx_projects_status(status)
- idx_projects_updated_at(updated_at)

---

## 5. Assets

### Table: assets
Stores stable asset family records.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- asset_type TEXT NOT NULL
- asset_category TEXT NOT NULL
- title TEXT
- current_version_number INTEGER NOT NULL DEFAULT 0
- current_asset_version_id TEXT NULL
- current_approved_asset_version_id TEXT NULL
- status TEXT NOT NULL
- approval_state TEXT NOT NULL DEFAULT 'unapproved'
- created_by TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'

Foreign keys:
- project_id -> projects.id

Suggested indexes:
- idx_assets_project_id(project_id)
- idx_assets_asset_type(asset_type)
- idx_assets_asset_category(asset_category)
- idx_assets_status(status)
- idx_assets_approval_state(approval_state)
- idx_assets_project_type(project_id, asset_type)
- idx_assets_current_approved_asset_version_id(current_approved_asset_version_id)

---

### Table: asset_versions
Stores immutable snapshots for asset content and provenance.

Suggested columns:
- id TEXT PRIMARY KEY
- asset_id TEXT NOT NULL
- project_id TEXT NOT NULL
- version_number INTEGER NOT NULL
- previous_version_id TEXT NULL
- parent_asset_id TEXT NULL
- status TEXT NOT NULL
- approval_state TEXT NOT NULL DEFAULT 'unapproved'
- source_mode TEXT NOT NULL
- created_by TEXT
- edited_by_last TEXT
- workflow_version_id TEXT NULL
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- content_json TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'
- locked_fields_json TEXT NOT NULL DEFAULT '[]'
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL

Foreign keys:
- asset_id -> assets.id
- project_id -> projects.id
- previous_version_id -> asset_versions.id
- workflow_version_id -> workflow_versions.id
- workflow_run_id -> workflow_runs.id
- node_run_id -> node_runs.id

Constraints:
- UNIQUE(asset_id, version_number)

Suggested indexes:
- idx_asset_versions_asset_id(asset_id)
- idx_asset_versions_project_id(project_id)
- idx_asset_versions_status(status)
- idx_asset_versions_approval_state(approval_state)
- idx_asset_versions_workflow_run_id(workflow_run_id)
- idx_asset_versions_workflow_version_id(workflow_version_id)

Notes:
- `content_json` stores the type-specific payload
- `metadata_json` stores extra metadata such as file properties, reproducibility info, or display settings
- `locked_fields_json` stores field paths like `content.appearance.face`
- `status` is lifecycle/operational state; `approval_state` is review state
- `current_approved_asset_version_id` points to the latest approved immutable version, which may differ from the current working version

---

### Table: asset_links
Stores typed relationships between specific asset versions or stable families.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- from_asset_id TEXT NOT NULL
- from_asset_version_id TEXT NULL
- to_asset_id TEXT NOT NULL
- to_asset_version_id TEXT NULL
- link_type TEXT NOT NULL
- strength TEXT NOT NULL DEFAULT 'strong'
- created_by TEXT
- created_at TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'

Foreign keys:
- project_id -> projects.id
- from_asset_id -> assets.id
- from_asset_version_id -> asset_versions.id
- to_asset_id -> assets.id
- to_asset_version_id -> asset_versions.id

Suggested indexes:
- idx_asset_links_project_id(project_id)
- idx_asset_links_from_asset_id(from_asset_id)
- idx_asset_links_to_asset_id(to_asset_id)
- idx_asset_links_link_type(link_type)
- idx_asset_links_project_from(project_id, from_asset_id)
- idx_asset_links_project_to(project_id, to_asset_id)

Notes:
- version ids are optional so links can point either to a stable family or an exact version
- exact-version links are best when reproducibility matters

---

### Table: asset_tags
Optional lightweight tagging table.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- asset_id TEXT NOT NULL
- asset_version_id TEXT NULL
- tag TEXT NOT NULL
- created_at TEXT NOT NULL

Constraints:
- UNIQUE(asset_id, asset_version_id, tag)

Suggested indexes:
- idx_asset_tags_asset_id(asset_id)
- idx_asset_tags_tag(tag)
- idx_asset_tags_project_tag(project_id, tag)

---

## 6. Workflow Definitions and Versions

### Table: workflow_definitions
Editable workflow drafts.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- title TEXT NOT NULL
- description TEXT
- mode TEXT NOT NULL
- status TEXT NOT NULL
- template_type TEXT NOT NULL
- created_by TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- defaults_json TEXT NOT NULL DEFAULT '{}'
- nodes_json TEXT NOT NULL DEFAULT '[]'
- edges_json TEXT NOT NULL DEFAULT '[]'
- metadata_json TEXT NOT NULL DEFAULT '{}'

Foreign keys:
- project_id -> projects.id

Suggested indexes:
- idx_workflow_definitions_project_id(project_id)
- idx_workflow_definitions_status(status)
- idx_workflow_definitions_template_type(template_type)

---

### Table: workflow_versions
Frozen workflow contracts.

Suggested columns:
- id TEXT PRIMARY KEY
- workflow_definition_id TEXT NOT NULL
- project_id TEXT NOT NULL
- version_number INTEGER NOT NULL
- status TEXT NOT NULL
- approved_by TEXT
- approved_at TEXT NULL
- graph_hash TEXT NOT NULL
- template_type TEXT NOT NULL
- frozen_workflow_json TEXT NOT NULL
- input_asset_versions_json TEXT NOT NULL DEFAULT '{}'
- runtime_environment_json TEXT NOT NULL DEFAULT '{}'
- notes TEXT
- created_at TEXT NOT NULL

Foreign keys:
- workflow_definition_id -> workflow_definitions.id
- project_id -> projects.id

Constraints:
- UNIQUE(workflow_definition_id, version_number)

Suggested indexes:
- idx_workflow_versions_project_id(project_id)
- idx_workflow_versions_workflow_definition_id(workflow_definition_id)
- idx_workflow_versions_status(status)
- idx_workflow_versions_graph_hash(graph_hash)

Notes:
- `frozen_workflow_json` contains nodes, edges, defaults, constraints, bindings, and validation behavior
- `input_asset_versions_json` pins canon or other upstream assets used for approval

---

## 7. Workflow Runs and Node Runs

### Table: workflow_runs
Execution instances of workflow versions.

Suggested columns:
- id TEXT PRIMARY KEY
- workflow_version_id TEXT NOT NULL
- project_id TEXT NOT NULL
- status TEXT NOT NULL
- triggered_by TEXT
- trigger_source TEXT NOT NULL
- rerun_of_workflow_run_id TEXT NULL
- started_at TEXT NOT NULL
- ended_at TEXT NULL
- resolved_input_snapshot_json TEXT NOT NULL DEFAULT '{}'
- summary_json TEXT NOT NULL DEFAULT '{}'
- logs_json TEXT NOT NULL DEFAULT '[]'
- warnings_json TEXT NOT NULL DEFAULT '[]'
- errors_json TEXT NOT NULL DEFAULT '[]'
- created_at TEXT NOT NULL

Foreign keys:
- workflow_version_id -> workflow_versions.id
- project_id -> projects.id

Suggested indexes:
- idx_workflow_runs_project_id(project_id)
- idx_workflow_runs_workflow_version_id(workflow_version_id)
- idx_workflow_runs_status(status)
- idx_workflow_runs_started_at(started_at)

Notes:
- `resolved_input_snapshot_json` stores the exact versioned inputs chosen for dynamic `asset_query` references at run start
- reruns should point `rerun_of_workflow_run_id` to the source run when they inherit its input snapshot

---

### Table: node_runs
Execution records for individual nodes.

Suggested columns:
- id TEXT PRIMARY KEY
- workflow_run_id TEXT NOT NULL
- workflow_version_id TEXT NOT NULL
- project_id TEXT NOT NULL
- node_id TEXT NOT NULL
- node_type TEXT NOT NULL
- status TEXT NOT NULL
- started_at TEXT NOT NULL
- ended_at TEXT NULL
- resolved_inputs_json TEXT NOT NULL DEFAULT '{}'
- effective_config_json TEXT NOT NULL DEFAULT '{}'
- effective_model_binding_json TEXT NOT NULL DEFAULT '{}'
- reproducibility_json TEXT NOT NULL DEFAULT '{}'
- created_outputs_json TEXT NOT NULL DEFAULT '[]'
- warnings_json TEXT NOT NULL DEFAULT '[]'
- errors_json TEXT NOT NULL DEFAULT '[]'
- created_at TEXT NOT NULL

Foreign keys:
- workflow_run_id -> workflow_runs.id
- workflow_version_id -> workflow_versions.id
- project_id -> projects.id

Suggested indexes:
- idx_node_runs_workflow_run_id(workflow_run_id)
- idx_node_runs_workflow_version_id(workflow_version_id)
- idx_node_runs_project_id(project_id)
- idx_node_runs_node_id(node_id)
- idx_node_runs_status(status)

Notes:
- `node_id` is the stable id from the frozen workflow graph
- `created_outputs_json` stores created asset version ids or job ids

---

### Table: project_events
Persistent event log for replayable UI updates and activity history.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- event_type TEXT NOT NULL
- target_type TEXT NULL
- target_id TEXT NULL
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- export_job_id TEXT NULL
- payload_json TEXT NOT NULL DEFAULT '{}'
- created_at TEXT NOT NULL

Suggested indexes:
- idx_project_events_project_id(project_id)
- idx_project_events_event_type(event_type)
- idx_project_events_created_at(created_at)
- idx_project_events_workflow_run_id(workflow_run_id)

Notes:
- this table backs `GET /projects/{projectId}/events`
- live WebSocket or SSE delivery should replay from the same persisted event stream

---

## 8. Outputs and Exports

### Table: outputs
Stable output families.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- output_type TEXT NOT NULL
- title TEXT NOT NULL
- current_version_number INTEGER NOT NULL DEFAULT 0
- current_output_version_id TEXT NULL
- status TEXT NOT NULL
- created_by TEXT
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'

Foreign keys:
- project_id -> projects.id

Suggested indexes:
- idx_outputs_project_id(project_id)
- idx_outputs_output_type(output_type)
- idx_outputs_status(status)

---

### Table: output_versions
Immutable output package definitions or cut manifests.

Suggested columns:
- id TEXT PRIMARY KEY
- output_id TEXT NOT NULL
- project_id TEXT NOT NULL
- version_number INTEGER NOT NULL
- status TEXT NOT NULL
- workflow_version_id TEXT NULL
- workflow_run_id TEXT NULL
- settings_json TEXT NOT NULL DEFAULT '{}'
- asset_refs_json TEXT NOT NULL DEFAULT '{}'
- manifest_json TEXT NOT NULL DEFAULT '{}'
- approval_state TEXT NOT NULL DEFAULT 'unapproved'
- created_by TEXT
- created_at TEXT NOT NULL

Foreign keys:
- output_id -> outputs.id
- project_id -> projects.id
- workflow_version_id -> workflow_versions.id
- workflow_run_id -> workflow_runs.id

Constraints:
- UNIQUE(output_id, version_number)

Suggested indexes:
- idx_output_versions_output_id(output_id)
- idx_output_versions_project_id(project_id)
- idx_output_versions_status(status)
- idx_output_versions_workflow_run_id(workflow_run_id)

---

### Table: export_jobs
Tracks preview and final export tasks.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- output_version_id TEXT NOT NULL
- workflow_run_id TEXT NULL
- export_type TEXT NOT NULL
- status TEXT NOT NULL
- requested_by TEXT
- settings_json TEXT NOT NULL DEFAULT '{}'
- output_file_id TEXT NULL
- started_at TEXT NULL
- ended_at TEXT NULL
- logs_json TEXT NOT NULL DEFAULT '[]'
- errors_json TEXT NOT NULL DEFAULT '[]'
- created_at TEXT NOT NULL

Foreign keys:
- project_id -> projects.id
- output_version_id -> output_versions.id

Suggested indexes:
- idx_export_jobs_project_id(project_id)
- idx_export_jobs_output_version_id(output_version_id)
- idx_export_jobs_status(status)

---

## 9. Review, Approval, and Validation

### Table: approvals
Generic approval history for assets, workflow versions, or outputs.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- target_type TEXT NOT NULL
- target_id TEXT NOT NULL
- decision TEXT NOT NULL
- decided_by TEXT NOT NULL
- notes TEXT
- created_at TEXT NOT NULL

Suggested indexes:
- idx_approvals_project_id(project_id)
- idx_approvals_target(target_type, target_id)
- idx_approvals_decision(decision)

Notes:
- `target_type` example values: asset_version, workflow_version, output_version
- `decision` example values: approved, rejected, revoked

---

### Table: comments
User or system comments attached to targets.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- target_type TEXT NOT NULL
- target_id TEXT NOT NULL
- author TEXT NOT NULL
- comment_text TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'
- created_at TEXT NOT NULL

Suggested indexes:
- idx_comments_project_id(project_id)
- idx_comments_target(target_type, target_id)

---

### Table: validation_results
Persistent validation outputs.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- target_type TEXT NOT NULL
- target_id TEXT NOT NULL
- validation_type TEXT NOT NULL
- status TEXT NOT NULL
- summary TEXT
- details_json TEXT NOT NULL DEFAULT '{}'
- created_at TEXT NOT NULL

Foreign keys:
- workflow_run_id -> workflow_runs.id
- node_run_id -> node_runs.id

Suggested indexes:
- idx_validation_results_project_id(project_id)
- idx_validation_results_target(target_type, target_id)
- idx_validation_results_status(status)
- idx_validation_results_validation_type(validation_type)

---

## 10. Jobs and Generation Tracking

### Table: jobs
Generic execution jobs for queue management.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- job_type TEXT NOT NULL
- status TEXT NOT NULL
- priority INTEGER NOT NULL DEFAULT 0
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- payload_json TEXT NOT NULL DEFAULT '{}'
- result_json TEXT NOT NULL DEFAULT '{}'
- retry_count INTEGER NOT NULL DEFAULT 0
- max_retries INTEGER NOT NULL DEFAULT 0
- started_at TEXT NULL
- ended_at TEXT NULL
- created_at TEXT NOT NULL

Suggested indexes:
- idx_jobs_project_id(project_id)
- idx_jobs_status(status)
- idx_jobs_job_type(job_type)
- idx_jobs_workflow_run_id(workflow_run_id)

Notes:
- this table supports queue orchestration and retry logic
- for simpler v1s, some teams may collapse jobs into node_runs, but separate jobs is cleaner

---

### Table: generation_records
Tracks normalized generation outputs from service calls.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- capability TEXT NOT NULL
- provider_name TEXT NOT NULL
- adapter_name TEXT NOT NULL
- model_name TEXT
- model_version TEXT
- request_json TEXT NOT NULL
- response_json TEXT NOT NULL
- status TEXT NOT NULL
- duration_ms INTEGER NULL
- created_at TEXT NOT NULL

Suggested indexes:
- idx_generation_records_project_id(project_id)
- idx_generation_records_node_run_id(node_run_id)
- idx_generation_records_capability(capability)
- idx_generation_records_provider(provider_name)

---

### Table: service_calls
Low-level adapter or provider call log.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- workflow_run_id TEXT NULL
- node_run_id TEXT NULL
- request_id TEXT NOT NULL
- capability TEXT NOT NULL
- provider_name TEXT NOT NULL
- adapter_name TEXT NOT NULL
- status TEXT NOT NULL
- error_code TEXT NULL
- error_message TEXT NULL
- retryable INTEGER NOT NULL DEFAULT 0
- duration_ms INTEGER NULL
- created_at TEXT NOT NULL

Suggested indexes:
- idx_service_calls_project_id(project_id)
- idx_service_calls_node_run_id(node_run_id)
- idx_service_calls_request_id(request_id)
- idx_service_calls_status(status)

---

## 11. File Metadata

### Table: file_records
Metadata for binary files stored on disk or remote storage.

Suggested columns:
- id TEXT PRIMARY KEY
- project_id TEXT NOT NULL
- asset_version_id TEXT NULL
- file_role TEXT NOT NULL
- storage_type TEXT NOT NULL
- file_path TEXT NOT NULL
- mime_type TEXT
- size_bytes INTEGER NULL
- checksum TEXT NULL
- width INTEGER NULL
- height INTEGER NULL
- duration_ms INTEGER NULL
- created_at TEXT NOT NULL
- metadata_json TEXT NOT NULL DEFAULT '{}'

Foreign keys:
- project_id -> projects.id
- asset_version_id -> asset_versions.id

Suggested indexes:
- idx_file_records_project_id(project_id)
- idx_file_records_asset_version_id(asset_version_id)
- idx_file_records_file_role(file_role)

Notes:
- `file_role` example values: source_upload, preview_image, final_video, voice_audio, export_file
- `storage_type` example values: local_fs, s3, blob

---

## 12. Suggested Status Enums
These can be TEXT in SQLite with application-level validation.

### Asset / output status
- draft
- needs_revision
- ready
- locked
- deprecated
- failed

### Approval state
- unapproved
- approved
- rejected

### Workflow definition status
- draft
- testing
- approved
- deprecated

### Workflow run / job / export status
- queued
- running
- completed
- failed
- canceled

### Validation status
- pass
- warn
- fail

---

## 13. Suggested MVP Query Patterns
This schema should support queries like:
- all current scenes for a project
- all approved scenes for a project
- all current shots in scene 3
- all assets affected by a changed character bible
- all outputs that include shot_012
- all workflow runs for workflow_version wf_ver_012
- all node runs that failed in the last project run
- latest preview image for a shot
- exact asset versions used in a specific output version
- all validation warnings for a project

---

## 14. SQLite Notes
Recommended choices for SQLite v1:
- use TEXT ids (UUID/ULID style)
- store flexible content as JSON strings
- keep heavy binary media out of DB
- add application-level schema validation for JSON fields
- migrate to Postgres later if query complexity or concurrency grows

---

## 15. Migration Strategy
Recommended path:
1. start with SQLite and JSON fields
2. validate query patterns during implementation
3. promote frequent JSON lookups to explicit columns later if needed
4. keep ids and versioning model stable so Postgres migration is straightforward

---

## 16. Minimal Initial Subset
If implementation needs a thinner start, the minimum essential tables are:
- projects
- assets
- asset_versions
- asset_links
- workflow_definitions
- workflow_versions
- workflow_runs
- node_runs
- outputs
- output_versions
- jobs
- file_records

Add next:
- approvals
- comments
- validation_results
- generation_records
- service_calls

---

## 17. Open Design Questions
1. Should workflow JSON be stored only in workflow_versions, with definitions as mutable drafts, or duplicated in both for convenience?
2. Should output_versions store full manifests or mostly links to asset versions?
3. Which JSON fields are most likely to deserve promotion to dedicated columns early?
4. Should file_records support remote URLs in v1 or remain local-first?
5. Is a separate jobs table necessary from day one, or can node_runs act as jobs initially?
6. How much referential integrity should be enforced in SQLite versus application logic?
7. Should tags be generalized to labels across projects and users later?
8. What retention policy should apply to logs, raw responses, and deprecated versions?
