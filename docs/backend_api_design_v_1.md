# Backend API Design v1

## 1. Purpose
Define the initial backend API contract for the story-to-media production system.

This API must support:
- project creation and management
- asset and asset-version operations
- workflow draft, approval, and execution
- outputs and exports
- comments, approvals, and validation results
- job progress and execution observability

The API should be practical for a desktop-first app and remain extensible for later multi-user or remote deployment.

---

## 2. Design Principles
1. Keep resources explicit and version-aware.
2. Separate editable drafts from immutable approved versions.
3. Avoid silent mutation of approved artifacts.
4. Prefer stable resource-oriented endpoints over vague RPC.
5. Use jobs for long-running operations.
6. Make progress and execution state observable.
7. Keep file upload/download flows simple in v1.

---

## 3. API Style
Recommended style for v1:
- REST-style JSON API for most operations
- WebSocket or Server-Sent Events for progress updates
- multipart upload endpoints for files

Suggested base path:
- `/api/v1`

Suggested response envelope for non-list endpoints:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

Suggested response envelope for list endpoints:

```json
{
  "ok": true,
  "data": {
    "items": [],
    "next_cursor": null,
    "total": 0
  },
  "error": null
}
```

Suggested error envelope:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "not_found",
    "message": "Workflow version not found.",
    "details": {}
  }
}
```

---

## 4. Resource Areas
Primary resource groups:
- projects
- files
- assets
- asset-versions
- links
- workflows
- workflow-versions
- workflow-runs
- outputs
- output-versions
- export-jobs
- jobs
- validations
- approvals
- comments
- events

---

## 5. Projects API

### POST /api/v1/projects
Create a project.

Request:
```json
{
  "title": "Rise Up Canada",
  "description": "World Cup anthem project",
  "primary_output_type": "music_video",
  "metadata": {}
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "project": {
      "id": "proj_001"
    }
  },
  "error": null
}
```

### GET /api/v1/projects
List projects.

Query params:
- `status`
- `cursor`
- `limit`
- `sort`

### GET /api/v1/projects/{projectId}
Get project details.

### PATCH /api/v1/projects/{projectId}
Update mutable project fields.

Mutable fields in v1:
- title
- description
- status
- metadata

### DELETE /api/v1/projects/{projectId}
Soft-delete or archive project.

---

## 6. File API

### POST /api/v1/projects/{projectId}/files
Upload a file.

Multipart form fields:
- `file`
- `role` (optional)
- `asset_type` (optional source asset hint)

Behavior:
- store file metadata in `file_records`
- optionally create a source asset + version

### GET /api/v1/projects/{projectId}/files
List file records.

### GET /api/v1/files/{fileId}
Get file metadata.

### GET /api/v1/files/{fileId}/content
Download or stream file.

---

## 7. Assets API

### POST /api/v1/projects/{projectId}/assets
Create a new asset family with initial version.

Request:
```json
{
  "asset_type": "scene",
  "asset_category": "production",
  "title": "Scene 3",
  "content": {},
  "metadata": {},
  "source_mode": "manual"
}
```

Behavior:
- create `assets` row
- create initial `asset_versions` row with version 1
- update current pointers on asset family

### GET /api/v1/projects/{projectId}/assets
List asset families.

Query params:
- `asset_type`
- `asset_category`
- `status`
- `approval_state`
- `tag`
- `scene_number`
- `scene_ref`
- `output_id`
- `linked_to_asset_id`
- `link_type`
- `include` (`current_version`, `current_approved_version`, `link_counts`)
- `cursor`
- `limit`

### GET /api/v1/assets/{assetId}
Get asset family and current version summary.

### GET /api/v1/assets/{assetId}/versions
List versions of an asset family.

### GET /api/v1/asset-versions/{assetVersionId}
Get exact immutable asset version.

### POST /api/v1/assets/{assetId}/versions
Create a new version for an existing asset family.

Request:
```json
{
  "content": {},
  "metadata": {},
  "status": "draft",
  "source_mode": "manual",
  "locked_fields": []
}
```

Rules:
- must not mutate old version
- creates a new immutable asset version
- optionally updates asset current pointer
- approval of the old version is not revoked automatically

### PATCH /api/v1/assets/{assetId}
Update mutable asset-family metadata.

Mutable fields in v1:
- title
- status
- metadata
- current_asset_version_id (with validation)

Notes:
- `status` is lifecycle state for the asset family, not review approval
- workflow and UI queries that need review-approved assets should filter by `approval_state=approved`

### POST /api/v1/assets/{assetId}/approve
Approve current or specified asset version.

Request:
```json
{
  "asset_version_id": "asset_ver_123",
  "notes": "Looks good"
}
```

Behavior:
- mark the specified immutable version as approved
- update `assets.current_approved_asset_version_id`
- update asset-family approval summary for list views

### POST /api/v1/assets/{assetId}/reject
Reject current or specified version.

### POST /api/v1/assets/{assetId}/lock
Lock asset or fields.

Request:
```json
{
  "asset_version_id": "asset_ver_123",
  "lock_type": "field",
  "fields": ["content.appearance.face", "content.wardrobe"]
}
```

### POST /api/v1/assets/{assetId}/unlock
Unlock asset or fields.

### GET /api/v1/projects/{projectId}/asset-graph
Return asset graph or filtered dependency view.

Query params:
- `asset_id`
- `depth`
- `direction` (upstream, downstream, both)
- `link_type`

---

## 8. Asset Links API

### POST /api/v1/projects/{projectId}/links
Create asset link.

Request:
```json
{
  "from_asset_id": "scene_03",
  "from_asset_version_id": "scene_03_v2",
  "to_asset_id": "shot_012",
  "to_asset_version_id": "shot_012_v4",
  "link_type": "contains",
  "strength": "strong",
  "metadata": {}
}
```

### GET /api/v1/projects/{projectId}/links
List links.

Query params:
- `from_asset_id`
- `to_asset_id`
- `link_type`

### DELETE /api/v1/links/{linkId}
Delete link.

---

## 9. Workflows API

### POST /api/v1/projects/{projectId}/workflows
Create workflow definition draft.

Request:
```json
{
  "title": "Film Preview Workflow",
  "description": "Draft workflow",
  "mode": "guided",
  "template_type": "film",
  "defaults": {},
  "nodes": [],
  "edges": [],
  "metadata": {}
}
```

### GET /api/v1/projects/{projectId}/workflows
List workflow definitions.

### GET /api/v1/workflows/{workflowId}
Get workflow definition.

### PATCH /api/v1/workflows/{workflowId}
Update mutable workflow definition draft.

Mutable fields in v1:
- title
- description
- mode
- status
- defaults
- nodes
- edges
- metadata

### POST /api/v1/workflows/{workflowId}/validate
Validate workflow definition for approval readiness.

Response includes:
- pass/warn/fail
- missing references
- missing bindings
- invalid node configs

### POST /api/v1/workflows/{workflowId}/versions
Create frozen workflow version from definition.

Request:
```json
{
  "input_asset_versions": {
    "synopsis": {
      "asset_id": "synopsis_01",
      "version": 3
    }
  },
  "runtime_environment": {},
  "notes": "Approval candidate"
}
```

Behavior:
- snapshot definition into immutable workflow version
- compute graph hash
- freeze approval-time input bindings and input selection policy

### GET /api/v1/workflows/{workflowId}/versions
List versions for a workflow definition.

### GET /api/v1/workflow-versions/{workflowVersionId}
Get exact frozen workflow version.

### POST /api/v1/workflow-versions/{workflowVersionId}/approve
Approve and freeze workflow version.

### POST /api/v1/workflow-versions/{workflowVersionId}/deprecate
Deprecate workflow version.

### POST /api/v1/workflow-versions/{workflowVersionId}/duplicate
Create a new draft workflow definition or version candidate from this version.

Useful for branching.

---

## 10. Workflow Execution API

### POST /api/v1/workflow-versions/{workflowVersionId}/runs
Trigger workflow run.

Request:
```json
{
  "trigger_source": "user",
  "options": {
    "execution_mode": "deterministic",
    "refresh_dynamic_inputs": true
  }
}
```

Response:
```json
{
  "ok": true,
  "data": {
    "workflow_run": {
      "id": "wf_run_204",
      "status": "queued"
    }
  },
  "error": null
}
```

Rules:
- explicit approval-time inputs from the workflow version stay pinned
- dynamic `asset_query` inputs must resolve to exact asset version ids at run start
- the resolved input snapshot must be stored on the workflow run

### GET /api/v1/projects/{projectId}/workflow-runs
List workflow runs for project home, workflow pages, and activity views.

Query params:
- `workflow_version_id`
- `status`
- `trigger_source`
- `cursor`
- `limit`

### GET /api/v1/workflow-versions/{workflowVersionId}/runs
List runs for one workflow version.

### GET /api/v1/workflow-runs/{workflowRunId}
Get workflow run summary.

### GET /api/v1/workflow-runs/{workflowRunId}/nodes
List node runs for a workflow run.

### GET /api/v1/node-runs/{nodeRunId}
Get exact node run details.

### POST /api/v1/workflow-runs/{workflowRunId}/cancel
Cancel workflow run.

### POST /api/v1/node-runs/{nodeRunId}/rerun
Rerun a single node.

Request:
```json
{
  "scope": "this_node_only",
  "refresh_dynamic_inputs": false
}
```

Allowed scope values in v1:
- `this_node_only`
- `this_node_and_downstream`

Rules:
- same workflow version
- creates new output asset versions
- records new node runs
- reuses the source run's resolved input snapshot by default unless refresh is explicitly requested

### POST /api/v1/workflow-runs/{workflowRunId}/rerun
Rerun entire workflow version.

Request:
```json
{
  "refresh_dynamic_inputs": false
}
```

---

## 11. Outputs API

### POST /api/v1/projects/{projectId}/outputs
Create output family.

Request:
```json
{
  "output_type": "film",
  "title": "Film Preview"
}
```

### GET /api/v1/projects/{projectId}/outputs
List outputs.

### GET /api/v1/outputs/{outputId}
Get output family.

### GET /api/v1/outputs/{outputId}/versions
List output versions.

### POST /api/v1/outputs/{outputId}/versions
Create output version.

Request:
```json
{
  "workflow_version_id": "wf_ver_012",
  "workflow_run_id": "wf_run_204",
  "settings": {
    "aspect_ratio": "16:9",
    "captions": false,
    "music": true,
    "narration": false
  },
  "asset_refs": {
    "shots": ["shot_101:v1", "shot_102:v1"]
  },
  "manifest": {}
}
```

### GET /api/v1/output-versions/{outputVersionId}
Get exact output version.

### POST /api/v1/output-versions/{outputVersionId}/approve
Approve output version.

### POST /api/v1/output-versions/{outputVersionId}/duplicate
Duplicate output version as new draft.

---

## 12. Export API

### POST /api/v1/output-versions/{outputVersionId}/exports
Create export job.

Request:
```json
{
  "export_type": "preview",
  "settings": {
    "target_format": "mp4",
    "resolution": "1280x720",
    "fps": 24
  }
}
```

Response returns export job id.

### GET /api/v1/output-versions/{outputVersionId}/exports
List export jobs for an output version.

### GET /api/v1/export-jobs/{exportJobId}
Get export job details.

### POST /api/v1/export-jobs/{exportJobId}/cancel
Cancel export job.

### GET /api/v1/export-jobs/{exportJobId}/file
Download or stream final file if ready.

---

## 13. Jobs API

### GET /api/v1/jobs/{jobId}
Get generic job state.

### GET /api/v1/projects/{projectId}/jobs
List jobs for project.

Query params:
- `status`
- `job_type`
- `cursor`
- `limit`

Useful for queue/debug views.

---

## 14. Validation API

### GET /api/v1/projects/{projectId}/validations
List validation results.

Query params:
- `target_type`
- `target_id`
- `validation_type`
- `status`

### GET /api/v1/validations/{validationId}
Get exact validation result.

### POST /api/v1/validations/run
Run ad hoc validation.

Request:
```json
{
  "project_id": "proj_001",
  "target_type": "asset_version",
  "target_id": "shot_012_v4",
  "validation_type": "continuity"
}
```

Useful for manual review tools.

---

## 15. Approvals API

### POST /api/v1/approvals
Create approval decision.

Request:
```json
{
  "project_id": "proj_001",
  "target_type": "workflow_version",
  "target_id": "wf_ver_012",
  "decision": "approved",
  "notes": "Ready for production"
}
```

### GET /api/v1/projects/{projectId}/approvals
List approval history.

Query params:
- `target_type`
- `target_id`
- `decision`

---

## 16. Comments API

### POST /api/v1/comments
Create comment.

Request:
```json
{
  "project_id": "proj_001",
  "target_type": "asset_version",
  "target_id": "shot_012_v4",
  "comment_text": "Face is good but the hand pose is slightly off."
}
```

### GET /api/v1/projects/{projectId}/comments
List comments.

Query params:
- `target_type`
- `target_id`

---

## 17. Event and Progress API

### GET /api/v1/projects/{projectId}/events
List recent events.

Query params:
- `cursor`
- `limit`
- `created_after`
- `event_type`
- `target_type`
- `target_id`

Event examples:
- workflow_run_started
- node_run_completed
- export_job_failed
- validation_created
- asset_version_created

### WebSocket /api/v1/ws/projects/{projectId}
Subscribe to live project events.

Rules:
- live delivery should be backed by the same persisted project event log as the REST endpoint
- reconnecting clients should be able to replay missed events by cursor or timestamp

Suggested event payload:
```json
{
  "event_type": "node_run_completed",
  "project_id": "proj_001",
  "workflow_run_id": "wf_run_204",
  "node_run_id": "node_run_01",
  "timestamp": "2026-04-11T10:00:00Z",
  "data": {}
}
```

Alternative for simpler v1:
- Server-Sent Events endpoint instead of WebSocket

---

## 18. Suggested Endpoint Rules

### Immutable resources
These must not support direct PATCH on frozen content:
- asset versions
- workflow versions
- output versions
- completed node runs

Changes require creation of new version records.

### Mutable resources
These may support PATCH:
- projects
- asset families
- workflow definitions
- outputs

### Long-running operations
Should return job/run ids and complete asynchronously:
- workflow run trigger
- export creation
- heavy validation runs
- large imports in future

---

## 19. Suggested Error Codes
Recommended initial codes:
- `bad_request`
- `not_found`
- `conflict`
- `validation_error`
- `approval_required`
- `immutable_resource`
- `dependency_error`
- `job_failed`
- `timeout`
- `service_unavailable`
- `forbidden_operation`

Example cases:
- trying to PATCH a workflow version -> `immutable_resource`
- trying to run an unapproved workflow version -> `approval_required`
- bad asset reference in workflow -> `dependency_error`

---

## 20. Suggested Pagination Model
For list endpoints, use cursor pagination where list size may grow.

Fields:
- `items`
- `next_cursor`
- `total` optional in v1

Can use simple `limit + created_at/id cursor` strategy.

---

## 21. Suggested Filtering Model
Common query filters:
- `status`
- `approval_state`
- `asset_type`
- `output_type`
- `workflow_version_id`
- `scene_number`
- `scene_ref`
- `output_id`
- `target_type`
- `target_id`
- `created_after`
- `created_before`

Keep filters shallow in v1. Avoid implementing arbitrary query DSL too early.

---

## 22. File and Media Delivery Notes
For desktop-first v1, acceptable patterns are:
- API returns metadata and local file path references for internal app use
- file content fetched through `/files/{fileId}/content`

If remote/web deployment happens later, replace local path assumptions with storage abstraction.

---

## 23. Suggested API Milestones

### Milestone 1
- projects
- assets + asset versions
- workflows + workflow versions
- workflow run trigger + run status
- files upload

### Milestone 2
- asset links graph endpoint
- outputs + output versions
- export jobs
- comments + approvals

### Milestone 3
- node rerun endpoints
- ad hoc validation endpoints
- richer event stream
- graph/query helpers

---

## 24. Example End-to-End Flow

### Create project
- `POST /projects`

### Upload source story
- `POST /projects/{id}/files`

### Create or import source asset
- `POST /projects/{id}/assets`

### Create workflow draft
- `POST /projects/{id}/workflows`

### Validate workflow draft
- `POST /workflows/{id}/validate`

### Create frozen workflow version
- `POST /workflows/{id}/versions`

### Approve workflow version
- `POST /workflow-versions/{id}/approve`

### Run workflow
- `POST /workflow-versions/{id}/runs`

### Observe progress
- `GET /workflow-runs/{id}`
- WebSocket project events

### Review created assets
- `GET /projects/{id}/assets`
- `GET /assets/{id}/versions`

### Create output version
- `POST /outputs/{id}/versions`

### Export preview
- `POST /output-versions/{id}/exports`

---

## 25. Open Design Questions
1. Should some “action” endpoints be grouped under `/actions/*` instead of resource subpaths, or is resource subpath style clearer?
2. Should workflow validation produce a persistent validation result immediately, or only return transient response data in v1?
3. Should file upload automatically create source assets by default?
4. Should output creation be explicit, or inferred from workflow runs in simple mode?
5. How much graph traversal should `/asset-graph` support in v1?
6. Should event streaming be WebSocket, SSE, or both in the first implementation?
7. Do we want batch endpoints early for creating many assets or links at once?
8. Should internal desktop APIs expose raw file paths, or only file ids plus stream endpoints?
