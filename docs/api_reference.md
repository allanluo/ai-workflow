# API Reference - Story-to-Media Production System v1

Base URL: `http://127.0.0.1:8787/api/v1`

API Documentation (Swagger UI): `http://127.0.0.1:8787/api/docs`

## Response Format

All API responses follow this envelope format:

### Success Response
```json
{
  "ok": true,
  "data": { /* Resource data */ },
  "error": null
}
```

### Error Response
```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {} // Optional - additional context
  }
}
```

---

## Endpoints

### Health & Status

#### GET /api/v1/health
Returns system health status.

**Response:**
```json
{
  "ok": true,
  "data": {
    "name": "ai-workflow-backend",
    "version": "0.1.0",
    "timestamp": "2024-04-11T12:00:00Z",
    "database": {
      "connected": true,
      "database_path": "/path/to/db",
      "size_bytes": 12345,
      "timestamp": "2024-04-11T12:00:00Z"
    }
  },
  "error": null
}
```

---

### Projects

#### POST /api/v1/projects
Create a new project.

**Request Body:**
```json
{
  "title": "My Story Project",
  "description": "A creative story adaptation",
  "primary_output_type": "film",
  "metadata": {}
}
```

**Response:** `201 Created`
```json
{
  "ok": true,
  "data": {
    "project": {
      "id": "proj_001",
      "title": "My Story Project",
      "status": "active",
      ...
    }
  },
  "error": null
}
```

#### GET /api/v1/projects
List all projects.

**Query Parameters:**
- `status`: "active" | "archived" (optional)

**Response:**
```json
{
  "ok": true,
  "data": {
    "items": [ /* Project objects */ ],
    "next_cursor": null
  },
  "error": null
}
```

#### GET /api/v1/projects/:projectId
Get project details.

#### PATCH /api/v1/projects/:projectId
Update project.

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "archived",
  "metadata": {}
}
```

#### DELETE /api/v1/projects/:projectId
Archive project (soft delete).

---

### Files

#### POST /api/v1/projects/:projectId/files
Upload a file to project.

**Form Data:**
- `file`: File (multipart)
- `role`: "source_upload" | "reference" (optional)
- `assetType`: Asset type hint (optional)

**Response:** `201 Created`
```json
{
  "ok": true,
  "data": {
    "file": {
      "id": "file_001",
      "project_id": "proj_001",
      "file_role": "source_upload",
      "file_path": "...",
      "mime_type": "text/plain",
      "size_bytes": 5000,
      "created_at": "..."
    }
  },
  "error": null
}
```

#### GET /api/v1/projects/:projectId/files
List project files.

---

### Assets

#### POST /api/v1/projects/:projectId/assets
Create asset.

**Request Body:**
```json
{
  "asset_type": "scene",
  "asset_category": "production",
  "title": "Opening Scene",
  "content": {},
  "metadata": {},
  "source_mode": "manual"
}
```

#### GET /api/v1/projects/:projectId/assets
List project assets.

#### GET /api/v1/projects/:projectId/assets/:assetId
Get asset details.

#### GET /api/v1/assets/:assetId/versions
List asset versions.

#### PATCH /api/v1/assets/:assetId/versions/:versionId/approval
Approve/reject asset version.

---

### Workflows

#### POST /api/v1/projects/:projectId/workflows
Create workflow definition.

**Request Body:**
```json
{
  "title": "Film Production Flow",
  "description": "Main workflow for film production",
  "mode": "guided",
  "template_type": "film",
  "nodes": [],
  "edges": [],
  "defaults": {},
  "metadata": {}
}
```

#### GET /api/v1/projects/:projectId/workflows
List workflow definitions.

#### PATCH /api/v1/workflows/:workflowId
Update workflow definition.

#### POST /api/v1/workflows/:workflowId/validate
Validate workflow.

**Response:**
```json
{
  "ok": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": []
  },
  "error": null
}
```

#### POST /api/v1/workflows/:workflowId/versions
Create workflow version (freeze workflow).

#### GET /api/v1/workflows/:workflowId/versions
List workflow versions.

#### POST /api/v1/workflows/:workflowId/versions/:versionId/runs
Create and start workflow run.

---

### Events

#### GET /api/v1/projects/:projectId/events
Get project events.

**Response:**
```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "event_001",
        "event_type": "workflow_run_started",
        "target_type": "workflow_run",
        "target_id": "run_001",
        "created_at": "2024-04-11T12:00:00Z",
        "payload": {}
      }
    ],
    "next_cursor": null
  },
  "error": null
}
```

#### GET /api/v1/projects/:projectId/events/stream
Server-Sent Events stream for real-time project updates.

---

## Error Codes

- `bad_request`: Validation error or malformed request
- `not_found`: Resource not found
- `internal_error`: Server error
- `unauthorized`: Authentication required
- `forbidden`: Permission denied

---

## Rate Limiting

Currently unlimited (local development). Future versions will implement rate limiting.

---

## Pagination

List endpoints support cursor-based pagination (future enhancement).

---

## Version History

- **v0.1.0** (April 2024): Initial schema and endpoints
