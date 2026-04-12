# Copilot Implementation Plan

## Overview

The copilot is an AI assistant that helps users create, edit, and manage workflows. Based on the core system design (`docs/core_system_design_v_1.md`), the copilot should:

- Interpret user intent
- Propose workflows
- Explain workflow decisions
- Highlight risks or drift points
- Suggest revisions
- Propose patches to assets or workflows

---

## Available Local APIs

The local AI service at `http://10.0.0.20:8001` provides:

| Endpoint                     | Purpose                          |
| ---------------------------- | -------------------------------- |
| `POST /api/llm/generate`     | Text generation via Ollama       |
| `POST /api/tts/generate`     | Text-to-speech (Piper/CosyVoice) |
| `POST /api/image/generate`   | Image generation via ComfyUI     |
| `POST /api/video/create`     | Video generation via ComfyUI     |
| `POST /api/music/generate`   | Music generation                 |
| `POST /api/sound/generate`   | Sound effect generation          |
| `POST /api/avatar/create`    | Avatar creation                  |
| `POST /api/avatar/{id}/talk` | Avatar talking video             |
| `POST /api/slideshow/create` | End-to-end slideshow pipeline    |
| `GET /api/jobs/{id}`         | Job status polling               |

---

## Architecture

### 1. Copilot Service Layer

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│  (Copilot chat panel, suggestion UI, workflow UI)   │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Copilot API                        │
│  /api/copilot/chat, /api/copilot/suggest            │
└─────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Intent Parser │ │ Workflow      │ │ Asset         │
│ (LLM-based)   │ │ Generator     │ │ Analyzer      │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│              Local AI Services                       │
│  (Ollama, ComfyUI, TTS, etc.)                       │
└─────────────────────────────────────────────────────┘
```

### 2. Database Schema Extensions

```sql
-- Copilot sessions
CREATE TABLE copilot_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  context JSON, -- project state snapshot
  metadata JSON
);

-- Copilot messages
CREATE TABLE copilot_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata JSON
);

-- Copilot suggestions
CREATE TABLE copilot_suggestions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  suggestion_type TEXT NOT NULL, -- 'workflow', 'asset', 'revision'
  status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
  payload JSON NOT NULL,
  created_at TEXT NOT NULL,
  accepted_at TEXT
);
```

---

## Implementation Phases

### Phase 1: Copilot Infrastructure (Week 1-2)

**1.1 Database Setup**

- Add `copilot_sessions`, `copilot_messages`, `copilot_suggestions` tables
- Update Drizzle schema

**1.2 Backend API**

- `POST /api/copilot/sessions` - Create session
- `GET /api/copilot/sessions/:id` - Get session history
- `POST /api/copilot/chat` - Send message, get response
- `GET /api/copilot/sessions/:id/suggestions` - Get pending suggestions

**1.3 Frontend Integration**

- Copilot chat panel component
- Suggestion toast/notification system

### Phase 2: Core Copilot Capabilities (Week 3-4)

**2.1 Intent Parser**

- Use LLM to parse user messages into structured intents
- Intent types:
  - `create_workflow` - Create new workflow
  - `edit_workflow` - Modify existing workflow
  - `generate_asset` - Generate media asset
  - `explain` - Explain workflow decisions
  - `suggest_revision` - Propose changes

**2.2 Workflow Generator**

- Use LLM to generate workflow definitions from intent
- Input: project context (sources, canon, existing workflows)
- Output: WorkflowDefinition JSON matching schema in core design

**2.3 Asset Analyzer**

- Analyze existing assets to inform copilot context
- Query assets by type, status, approval state

### Phase 3: UI Integration (Week 5-6)

**3.1 Chat Interface**

- Message history
- Typing indicators
- Code/formatted output display

**3.2 Suggestion UI**

- Inline workflow suggestions
- Accept/reject workflow edits
- Preview proposed changes

**3.3 Context Panel**

- Show current project context being used
- Allow context refinement

### Phase 4: Advanced Features (Week 7-8)

**4.1 Drift Detection**

- Compare proposed workflow vs existing canon
- Highlight potential continuity issues

**4.2 Explanation Engine**

- Explain why certain nodes are recommended
- Show node relationships

**4.3 Revision Proposals**

- Propose asset patches
- Suggest scene/shot modifications

---

## API Contract Examples

### Chat Request

```typescript
POST /api/copilot/chat
{
  session_id: "session_001",
  message: "Create a workflow for a 2-minute film about a survival story",
  project_id: "proj_001"
}
```

### Chat Response

```typescript
{
  session_id: "session_001",
  message: {
    role: "assistant",
    content: "I'll create a workflow for your survival story film. Here's what I'm proposing...",
    suggested_workflow: {
      id: "wf_def_new",
      title: "Survival Story Film Workflow",
      template_type: "film",
      nodes: [
        { type: "extract_canon", ... },
        { type: "generate_scenes", ... },
        { type: "generate_shot_plan", ... },
        { type: "generate_narration", ... },
        { type: "render_preview", ... }
      ]
    }
  }
}
```

### Suggestion Types

```typescript
type CopilotSuggestion =
  | { type: "workflow_create", payload: WorkflowDefinition }
  | { type: "workflow_edit", payload: { workflow_id: string, changes: ... } }
  | { type: "asset_generate", payload: { asset_type: string, config: ... } }
  | { type: "revision_propose", payload: { asset_id: string, suggested_changes: ... } };
```

---

## LLM Prompt Strategy

System prompt for copilot:

```
You are a creative production copilot for a story-to-media workflow system.

Your responsibilities:
1. Help users create workflows for film, music video, short-form video, and audio story outputs
2. Propose meaningful workflow nodes (input, planning, generation, validation, assembly, export)
3. Explain your decisions and highlight potential issues
4. Work within the project's canon and source material

Available node types:
- Input: ingest_source, parse_story, import_music
- Planning: extract_canon, generate_beat_sheet, generate_scenes, generate_shot_plan, generate_narration, generate_captions
- Generation: generate_image, generate_video_clip, generate_voice
- Validation: validate_continuity, validate_style, validate_duration
- Assembly: assemble_timeline, render_preview, render_final

Guidelines:
- Propose workflows that respect existing canon
- Consider output type (film, music_video, short_form, audio_story)
- Use deterministic mode by default
- Keep workflow nodes meaningful at creative-production level
```

---

## Frontend Components

| Component           | Responsibility              |
| ------------------- | --------------------------- |
| `CopilotPanel`      | Main chat interface         |
| `CopilotMessage`    | Single message display      |
| `CopilotSuggestion` | Accept/reject suggestion UI |
| `WorkflowPreview`   | Preview proposed workflow   |
| `CopilotContextBar` | Show current context        |

---

## Next Steps

1. **Confirm Phase 1 priority** - Should copilot start with chat or suggestion-only mode?
2. **Define output types** - Which output types should copilot support first? (film, music_video, short_form, audio_story)
3. **Confirm LLM model** - Which Ollama model to use? (e.g., qwen3:8b, llama3)
4. **Define initial workflow templates** - Start with pre-defined templates or fully generative?

---

## Dependencies

- Backend: Fastify, Drizzle, Zod
- Frontend: React, TanStack Query, Zustand
- Local API: Ollama (LLM), ComfyUI (image/video), TTS providers
