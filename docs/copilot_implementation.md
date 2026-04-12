# Copilot Implementation Document

## 1. Overview

The copilot is an AI assistant integrated into the story-to-media production system. It helps users create workflows, generate assets, and manage projects through natural language interaction.

### 1.1 Core Responsibilities

- **Intent Interpretation**: Parse user messages into actionable requests
- **Workflow Proposal**: Generate workflow definitions based on user intent
- **Decision Explanation**: Explain workflow decisions and highlight considerations
- **Revision Suggestions**: Propose improvements to existing workflows and assets

### 1.2 Design Principles

- Copilot is a **planner and assistant**, not an autonomous executor
- Important changes are **reviewable before execution**
- All copilot-generated content is **traceable** to the source message
- User **manual overrides always win**

---

## 2. System Architecture

### 2.1 Component Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ ChatPanel   │  │ Suggestion  │  │ ContextSidebar      │ │
│  │             │  │ Toast       │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                    Copilot API (Fastify)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Intent Parser │    │ Workflow      │    │ Asset         │
│ Service       │    │ Generator     │    │ Service       │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Local AI Services                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Ollama   │  │ ComfyUI  │  │ TTS      │  │ Slideshow  │  │
│  │ (LLM)    │  │ (Image)  │  │ (Piper)  │  │ Pipeline   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. User sends message via chat UI
2. Backend receives message, loads project context
3. Intent Parser determines what the user wants
4. Appropriate service (Workflow Generator, Asset Service) processes request
5. Response with suggestions/actions returned to UI
6. User can accept/reject suggestions

---

## 3. Database Schema

### 3.1 Tables

```sql
-- Copilot sessions: persistent conversation context
CREATE TABLE copilot_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  context JSON, -- project state snapshot
  metadata JSON
);

-- Copilot messages: conversation history
CREATE TABLE copilot_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES copilot_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata JSON
);

-- Copilot suggestions: proposed actions awaiting user decision
CREATE TABLE copilot_suggestions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES copilot_sessions(id),
  suggestion_type TEXT NOT NULL, -- 'workflow_create', 'workflow_edit', 'asset_generate'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  title TEXT,
  description TEXT,
  payload JSON NOT NULL, -- the actual suggested content
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  rejected_at TEXT,
  metadata JSON
);

-- Indexes
CREATE INDEX idx_copilot_sessions_project ON copilot_sessions(project_id);
CREATE INDEX idx_copilot_messages_session ON copilot_messages(session_id);
CREATE INDEX idx_copilot_suggestions_session ON copilot_suggestions(session_id);
CREATE INDEX idx_copilot_suggestions_status ON copilot_suggestions(status);
```

### 3.2 Drizzle Schema

```typescript
// packages/database/src/copilot.ts
import { sqliteTable, text, integer, json } from 'drizzle-orm/sqlite-core';

export const copilotSessions = sqliteTable('copilot_sessions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  context: json('context'),
  metadata: json('metadata'),
});

export const copilotMessages = sqliteTable('copilot_messages', {
  id: text('id').primaryKey',
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  metadata: json('metadata'),
});

export const copilotSuggestions = sqliteTable('copilot_suggestions', {
  id: text('id').primaryKey,
  sessionId: text('session_id').notNull(),
  suggestionType: text('suggestion_type').notNull(),
  status: text('status').notNull().default('pending'),
  title: text('title'),
  description: text('description'),
  payload: json('payload').notNull(),
  createdAt: text('created_at').notNull(),
  acceptedAt: text('accepted_at'),
  rejectedAt: text('rejected_at'),
  metadata: json('metadata'),
});
```

---

## 4. Backend API

### 4.1 Endpoints

| Method | Path                                  | Description                |
| ------ | ------------------------------------- | -------------------------- |
| POST   | /api/copilot/sessions                 | Create new copilot session |
| GET    | /api/copilot/sessions/:id             | Get session with messages  |
| GET    | /api/copilot/sessions/:id/suggestions | Get pending suggestions    |
| POST   | /api/copilot/chat                     | Send message, get response |
| POST   | /api/copilot/suggestions/:id/accept   | Accept suggestion          |
| POST   | /api/copilot/suggestions/:id/reject   | Reject suggestion          |
| DELETE | /api/copilot/sessions/:id             | Delete session             |

### 4.2 API Schemas

```typescript
// Create session request
interface CreateCopilotSessionRequest {
  project_id: string;
  title?: string;
  context?: ProjectContext;
}

// Chat request
interface CopilotChatRequest {
  session_id: string;
  message: string;
  project_id: string;
}

// Chat response
interface CopilotChatResponse {
  session_id: string;
  message: CopilotMessage;
  suggestions: CopilotSuggestion[];
}

// Suggestion types
type CopilotSuggestion =
  | WorkflowCreateSuggestion
  | WorkflowEditSuggestion
  | AssetGenerateSuggestion;

interface WorkflowCreateSuggestion {
  type: 'workflow_create';
  title: string;
  description: string;
  payload: WorkflowDefinition;
}

interface WorkflowEditSuggestion {
  type: 'workflow_edit';
  title: string;
  description: string;
  payload: {
    workflow_id: string;
    changes: Partial<WorkflowDefinition>;
  };
}

interface AssetGenerateSuggestion {
  type: 'asset_generate';
  title: string;
  description: string;
  payload: {
    asset_type: 'image' | 'video' | 'audio' | 'slideshow';
    config: GenerateRequest;
  };
}
```

### 4.3 Request/Response Examples

**Create Session**

```bash
POST /api/copilot/sessions
{
  "project_id": "proj_001",
  "title": "Survival Story Copilot"
}

# Response
{
  "id": "copilot_session_001",
  "project_id": "proj_001",
  "title": "Survival Story Copilot",
  "created_at": "2026-04-12T10:00:00Z",
  "updated_at": "2026-04-12T10:00:00Z"
}
```

**Chat**

```bash
POST /api/copilot/chat
{
  "session_id": "copilot_session_001",
  "project_id": "proj_001",
  "message": "Create a workflow for a 2-minute film about survival"
}

# Response
{
  "session_id": "copilot_session_001",
  "message": {
    "id": "msg_001",
    "role": "assistant",
    "content": "I'll create a film workflow for your survival story. Here's what I'm proposing:\n\n**Workflow: Survival Story Film**\n- 5 scenes generated from your canon\n- Cinematic shot plan with 4-5 shots per scene\n- AI narration with voice 'f1.mp3'\n- Preview render at 16:9",
    "created_at": "2026-04-12T10:01:00Z"
  },
  "suggestions": [
    {
      "id": "sug_001",
      "type": "workflow_create",
      "title": "Create Survival Story Film Workflow",
      "description": "5-scene film workflow with narration",
      "payload": {
        "id": "wf_def_survival_001",
        "project_id": "proj_001",
        "title": "Survival Story Film",
        "template_type": "film",
        "nodes": [...],
        "edges": [...]
      }
    }
  ]
}
```

---

## 5. Copilot Services

### 5.1 Intent Parser

The intent parser uses LLM to classify user messages into structured intents.

```typescript
// packages/backend/src/copilot/services/intent-parser.ts
interface Intent {
  type:
    | 'create_workflow'
    | 'edit_workflow'
    | 'generate_asset'
    | 'explain'
    | 'suggest_revision'
    | 'general_chat';
  entities: {
    project_id?: string;
    workflow_id?: string;
    asset_type?: string;
    output_type?: string;
    parameters?: Record<string, unknown>;
  };
  confidence: number;
}

const INTENT_PROMPT = `
You are an intent classifier for a creative production copilot.

Classify the user message into one of these intents:
- create_workflow: User wants to create a new workflow
- edit_workflow: User wants to modify an existing workflow
- generate_asset: User wants to generate media (image, video, audio)
- explain: User wants explanation of something
- suggest_revision: User wants to propose changes
- general_chat: General conversation

Return JSON with:
- type: the classified intent
- entities: relevant extracted information (project_id, workflow_id, asset_type, output_type, parameters)
- confidence: 0-1 confidence score

User message: {userMessage}
`;

async function parseIntent(message: string, context: ProjectContext): Promise<Intent> {
  const prompt = INTENT_PROMPT.replace('{userMessage}', message);

  const response = await llmGenerate({
    model: 'qwen3:8b',
    prompt,
  });

  return JSON.parse(response);
}
```

### 5.2 Workflow Generator

Generates workflow definitions from user intent using LLM.

```typescript
// packages/backend/src/copilot/services/workflow-generator.ts
interface WorkflowGenerationParams {
  intent: Intent;
  projectContext: ProjectContext;
  outputType: 'film' | 'music_video' | 'short_form' | 'audio_story';
}

const WORKFLOW_GENERATION_PROMPT = `
You are a workflow generator for a story-to-media production system.

Generate a workflow definition based on the user's request.

Project context:
- Sources: {sources}
- Canon: {canon}
- Existing workflows: {workflows}

Requested output type: {outputType}

Available node types:
- Input: ingest_source, parse_story, import_music
- Planning: extract_canon, generate_beat_sheet, generate_scenes, generate_shot_plan, generate_narration, generate_captions
- Generation: generate_image, generate_video_clip, generate_voice
- Validation: validate_continuity, validate_style, validate_duration
- Assembly: assemble_timeline, render_preview, render_final

Return a complete WorkflowDefinition JSON matching this schema:
{
  id: string,
  project_id: string,
  title: string,
  description: string,
  template_type: "film" | "music_video" | "short_form" | "audio_story",
  mode: "guided",
  status: "draft",
  nodes: Node[],
  edges: Edge[],
  defaults: WorkflowDefaults
}

User request: {userRequest}
`;

async function generateWorkflow(params: WorkflowGenerationParams): Promise<WorkflowDefinition> {
  const prompt = buildPrompt(WORKFLOW_GENERATION_PROMPT, params);
  const response = await llmGenerate({ model: 'qwen3:8b', prompt });

  return validateWorkflowDefinition(JSON.parse(response));
}
```

### 5.3 Asset Service

Handles asset generation requests by calling appropriate local APIs.

```typescript
// packages/backend/src/copilot/services/asset-service.ts
interface AssetGenerationRequest {
  asset_type: 'image' | 'video' | 'audio' | 'slideshow';
  config: {
    prompt?: string;
    text?: string;
    workflow?: string;
    // ... type-specific config
  };
  project_id: string;
}

async function generateAsset(request: AssetGenerationRequest): Promise<GenerationResult> {
  switch (request.asset_type) {
    case 'image':
      return imageGenerate(request.config);
    case 'video':
      return videoGenerate(request.config);
    case 'audio':
      return ttsGenerate(request.config);
    case 'slideshow':
      return slideshowCreate(request.config);
  }
}

async function imageGenerate(config: ImageGenerateConfig): Promise<ImageGenerateResponse> {
  const response = await fetch('http://10.0.0.20:8001/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: config.prompt,
      workflow: config.workflow || 'txt2img',
      width: config.width || 1024,
      height: config.height || 1024,
    }),
  });
  return response.json();
}
```

---

## 6. Frontend Implementation

### 6.1 Components

```
src/features/copilot/
├── components/
│   ├── CopilotPanel.tsx          # Main chat container
│   ├── CopilotChat.tsx          # Message list
│   ├── CopilotMessage.tsx       # Single message
│   ├── CopilotInput.tsx         # Message input
│   ├── SuggestionCard.tsx      # Accept/reject card
│   ├── WorkflowPreview.tsx     # Workflow preview
│   └── CopilotEmpty.tsx         # Empty state
├── hooks/
│   ├── useCopilotSession.ts     # Session management
│   ├── useCopilotChat.ts        # Chat operations
│   └── useCopilotSuggestions.ts # Suggestion handling
├── api/
│   └── copilot.ts               # API client
├── stores/
│   └── copilotStore.ts          # Zustand store
└── types/
    └── index.ts                 # TypeScript types
```

### 6.2 Component: CopilotPanel

```typescript
// src/features/copilot/components/CopilotPanel.tsx
import { useCopilotChat } from '../hooks/useCopilotChat';
import { CopilotChat } from './CopilotChat';
import { CopilotInput } from './CopilotInput';
import { SuggestionCard } from './SuggestionCard';

export function CopilotPanel({ projectId }: { projectId: string }) {
  const { messages, isLoading, sendMessage, suggestions, acceptSuggestion, rejectSuggestion } =
    useCopilotChat(projectId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <CopilotChat messages={messages} />
      </div>

      {suggestions.length > 0 && (
        <div className="border-t p-4 space-y-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={() => acceptSuggestion(suggestion.id)}
              onReject={() => rejectSuggestion(suggestion.id)}
            />
          ))}
        </div>
      )}

      <CopilotInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
```

### 6.3 Hook: useCopilotChat

```typescript
// src/features/copilot/hooks/useCopilotChat.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { copilotApi } from '../api/copilot';

export function useCopilotChat(projectId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Create session on mount
  const createSession = useMutation({
    mutationFn: () => copilotApi.createSession({ project_id: projectId }),
    onSuccess: data => setSessionId(data.id),
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: (message: string) =>
      copilotApi.chat({ session_id: sessionId!, message, project_id: projectId }),
  });

  // Get messages
  const { data: messages = [] } = useQuery({
    queryKey: ['copilot', sessionId, 'messages'],
    queryFn: () => (sessionId ? copilotApi.getMessages(sessionId) : []),
    enabled: !!sessionId,
  });

  // Get suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['copilot', sessionId, 'suggestions'],
    queryFn: () => (sessionId ? copilotApi.getSuggestions(sessionId) : []),
    enabled: !!sessionId,
  });

  return {
    sessionId,
    messages,
    suggestions,
    isLoading: sendMessage.isPending,
    sendMessage: (msg: string) => sendMessage.mutate(msg),
    acceptSuggestion: (id: string) => copilotApi.acceptSuggestion(id),
    rejectSuggestion: (id: string) => copilotApi.rejectSuggestion(id),
  };
}
```

---

## 7. API Client

```typescript
// src/lib/api/copilot.ts
const BASE_URL = '/api/copilot';

export const copilotApi = {
  createSession: (data: CreateSessionRequest) =>
    fetchJson<CopilotSession>(`${BASE_URL}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSession: (id: string) => fetchJson<CopilotSession>(`${BASE_URL}/sessions/${id}`),

  getMessages: (sessionId: string) =>
    fetchJson<CopilotMessage[]>(`${BASE_URL}/sessions/${sessionId}/messages`),

  getSuggestions: (sessionId: string) =>
    fetchJson<CopilotSuggestion[]>(`${BASE_URL}/sessions/${sessionId}/suggestions`),

  chat: (data: ChatRequest) =>
    fetchJson<ChatResponse>(`${BASE_URL}/chat`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  acceptSuggestion: (id: string) =>
    fetchJson<void>(`${BASE_URL}/suggestions/${id}/accept`, {
      method: 'POST',
    }),

  rejectSuggestion: (id: string) =>
    fetchJson<void>(`${BASE_URL}/suggestions/${id}/reject`, {
      method: 'POST',
    }),

  deleteSession: (id: string) =>
    fetchJson<void>(`${BASE_URL}/sessions/${id}`, {
      method: 'DELETE',
    }),
};
```

---

## 8. Service Adapter Integration

### 8.1 Local API Configuration

```typescript
// packages/backend/src/config.ts
export const config = {
  localApi: {
    baseUrl: process.env.LOCAL_API_URL || 'http://10.0.0.20:8001',
    timeout: 300000, // 5 minutes
  },
  llm: {
    defaultModel: process.env.LLM_MODEL || 'qwen3:8b',
    temperature: 0.2,
  },
};
```

### 8.2 Service Adapter Map

```typescript
// packages/backend/src/copilot/adapters/local-api-adapter.ts
import { config } from '../config';

const API = config.localApi.baseUrl;

export const localApiAdapter = {
  async generateText(prompt: string, model?: string): Promise<LLMGenerateResponse> {
    const response = await fetch(`${API}/api/llm/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || config.llm.defaultModel,
        prompt,
        stream: false,
      }),
    });
    return response.json();
  },

  async generateImage(config: ImageGenerateRequest): Promise<ImageGenerateResponse> {
    const response = await fetch(`${API}/api/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async generateTTS(config: TTSGenerateRequest): Promise<TTSGenerateResponse> {
    const response = await fetch(`${API}/api/tts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async createSlideshow(config: SlideshowCreateRequest): Promise<SlideshowCreateResponse> {
    const response = await fetch(`${API}/api/slideshow/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return response.json();
  },

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await fetch(`${API}/api/jobs/${jobId}`);
    return response.json();
  },
};
```

---

## 9. Copilot System Prompt

```typescript
// packages/backend/src/copilot/prompts/system.ts
export const COPILOT_SYSTEM_PROMPT = `
You are a creative production copilot for a story-to-media workflow system.

Your responsibilities:
1. Help users create workflows for film, music video, short-form video, and audio story outputs
2. Propose meaningful workflow nodes at the creative-production level (not low-level technical nodes)
3. Explain your decisions and highlight potential issues or drift points
4. Respect existing project canon and source material
5. Work within the project's approved assets and constraints

Available workflow node types:
- Input: ingest_source, parse_story, import_music
- Planning: extract_canon, generate_beat_sheet, generate_scenes, generate_shot_plan, generate_narration, generate_captions
- Generation: generate_image, generate_video_clip, generate_voice
- Validation: validate_continuity, validate_style, validate_duration
- Assembly: assemble_timeline, render_preview, render_final

Guidelines:
- Propose workflows that respect existing canon
- Consider output type (film, music_video, short_form, audio_story)
- Use deterministic execution mode by default (fixed seeds, locked prompts)
- Keep workflows simple enough for initial implementation
- Highlight any assumptions or uncertainties in your proposals

When generating workflows:
1. Start with input/parsing nodes for source material
2. Add planning nodes to structure the approach
3. Include generation nodes for media production
4. Add validation nodes for quality checks
5. End with assembly and render nodes for output

When the user asks for clarification, ask pointed questions to understand their intent.
When proposing changes, explain the reasoning behind each recommendation.
`;
```

---

## 10. Error Handling

### 10.1 Error Types

```typescript
// packages/backend/src/copilot/errors.ts
export class CopilotError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CopilotError';
  }
}

export const ErrorCodes = {
  INVALID_INTENT: 'INVALID_INTENT',
  WORKFLOW_GENERATION_FAILED: 'WORKFLOW_GENERATION_FAILED',
  ASSET_GENERATION_FAILED: 'ASSET_GENERATION_FAILED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  LOCAL_API_ERROR: 'LOCAL_API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;
```

### 10.2 Error Handling Middleware

```typescript
// packages/backend/src/copilot/middleware/error-handler.ts
export async function copilotErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof CopilotError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
  }

  // Log unexpected errors
  request.log.error(error);

  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

- Intent parser classification accuracy
- Workflow generation validation
- Suggestion acceptance/rejection flow

### 11.2 Integration Tests

- End-to-end chat flow
- Local API adapter responses
- Database persistence

### 11.3 Test Fixtures

```typescript
// packages/backend/src/copilot/__tests__/fixtures.ts
export const mockProjectContext: ProjectContext = {
  project_id: 'proj_001',
  sources: [{ id: 'src_001', type: 'source_story', content: 'A survival story...' }],
  canon: [{ id: 'canon_001', type: 'synopsis', content: { text: '...' } }],
  workflows: [],
  assets: [],
};

export const mockUserMessage = 'Create a workflow for a 2-minute film';
```

---

## 12. Implementation Checklist

### Phase 1: Infrastructure

- [ ] Add database tables (sessions, messages, suggestions)
- [ ] Create Drizzle schema
- [ ] Implement session CRUD endpoints
- [ ] Implement chat endpoint
- [ ] Implement suggestion accept/reject endpoints

### Phase 2: Core Capabilities

- [ ] Implement Intent Parser with LLM
- [ ] Implement Workflow Generator with LLM
- [ ] Implement Asset Service with local API adapter
- [ ] Add system prompt for copilot behavior

### Phase 3: Frontend Integration

- [ ] Create CopilotPanel component
- [ ] Create chat input and message display
- [ ] Create suggestion card with accept/reject
- [ ] Implement Zustand store for copilot state
- [ ] Connect to TanStack Query for API

### Phase 4: Advanced Features

- [ ] Add drift detection logic
- [ ] Add explanation generation
- [ ] Implement revision proposals

---

## 13. File Structure

```
packages/
├── backend/
│   └── src/
│       ├── copilot/
│       │   ├── index.ts              # Route registration
│       │   ├── errors.ts             # Error types
│       │   ├── prompts/
│       │   │   └── system.ts         # System prompts
│       │   ├── services/
│       │   │   ├── index.ts          # Service exports
│       │   │   ├── intent-parser.ts  # Intent classification
│       │   │   ├── workflow-generator.ts
│       │   │   └── asset-service.ts
│       │   ├── adapters/
│       │   │   └── local-api-adapter.ts
│       │   └── __tests__/
│       │       ├── intent-parser.test.ts
│       │       └── workflow-generator.test.ts
├── database/
│   └── src/
│       └── copilot.ts                # Drizzle schema
└── frontend/
    └── src/
        ├── features/
        │   └── copilot/
        │       ├── components/
        │       ├── hooks/
        │       ├── api/
        │       ├── stores/
        │       └── types/
        └── App.tsx                   # Include CopilotPanel in layout
```

---

## 14. Dependencies

### Backend

- `fastify` - HTTP server
- `drizzle-orm` - Database ORM
- `zod` - Validation

### Frontend

- `react` - UI framework
- `@tanstack/react-query` - Server state
- `zustand` - Client state

### External

- Local Ollama (LLM)
- Local ComfyUI (image/video)
- Local TTS (piper/cosyvoice)
