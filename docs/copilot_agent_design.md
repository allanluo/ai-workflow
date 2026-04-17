# AI Workflow Studio - Copilot Agent Design

## Overview

The Copilot Agent is an AI-powered assistant that helps users create videos, similar to how code assistants (Cursor, Claude Code) help users write code. Just as a code assistant has full access to a codebase, the Copilot Agent has full access to the video production system—workflows, assets, scenes, shots, outputs, and exports.

This design is inspired by Cursor's architecture, adapted for video production.

## Comparison with Cursor

| Feature        | Cursor (Code)   | Our Copilot (Video)       |
| -------------- | --------------- | ------------------------- |
| Context Engine | RAG on codebase | RAG on project assets     |
| Tool System    | 15+ file tools  | 15+ video tools           |
| Multi-Agent    | 8 parallel      | Future expansion          |
| Isolation      | Git worktree    | Task isolation            |
| Agent Mode     | Auto-execute    | Auto-execute              |
| MCP            | Figma, GitHub   | Render farms, stock media |

---

## Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COPILOT CAPABILITIES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  READ (Knowledge)          WRITE (Actions)         MONITOR (State)         │
│  ─────────────────        ───────────────          ──────────────────       │
│  • Project config         • Create workflows       • Workflow runs          │
│  • Workflows/nodes        • Modify nodes           • Node executions       │
│  • Assets (all types)     • Delete items           • Export jobs           │
│  • Outputs                • Create assets          • Task progress         │
│  • Runs history           • Run workflows          • Errors/failures       │
│  • Export jobs            • Export videos          • Queue status          │
│  • Timeline/clips         • Update settings                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE COPILOT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Context Engine                                     │  │
│  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐    │  │
│  │  │ Context Index │← │   Retriever      │← │     Query          │    │  │
│  │  │                │  │                  │  │                    │    │  │
│  │  │ • Assets       │  │ • Semantic       │  │ • Current msg      │    │  │
│  │  │ • Workflows    │  │ • Keyword        │  │ • @mentions        │    │  │
│  │  │ • Nodes        │  │ • Recent         │  │ • History          │    │  │
│  │  │ • Outputs      │  │ • Similarity     │  │                    │    │  │
│  │  │ • Runs         │  │                  │  │                    │    │  │
│  │  └───────┬────────┘  └────────┬─────────┘  └────────────────────┘    │  │
│  │          │                     │                                       │  │
│  │          ▼                     ▼                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐    │  │
│  │  │              Context Builder                                    │    │  │
│  │  │  • Assemble context from retrieved items                        │    │  │
│  │  │  • Format for LLM (system prompt + retrieved content)           │    │  │
│  │  │  • Truncate to max tokens                                       │    │  │
│  │  └────────────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────┬───────────────────────────────────────────┘  │
│                                │                                             │
│  ┌─────────────────────────────▼───────────────────────────────────────┐   │
│  │                    Planner (LLM)                                       │   │
│  │  • Decompose complex requests                                          │   │
│  │  • Generate execution plan                                             │   │
│  │  • Determine tool sequence                                             │   │
│  │  • Verify results                                                      │   │
│  └────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                             │
│  ┌─────────────────────────────▼───────────────────────────────────────┐   │
│  │                    Tool Executor                                       │   │
│  │  • Execute tools in parallel                                           │   │
│  │  • Handle dependencies                                                 │   │
│  │  • Verify results                                                      │   │
│  │  • Retry on failure                                                    │   │
│  └────────────────────────────┬───────────────────────────────────────────┘   │
│                                │                                             │
│         ┌─────────────────────┼─────────────────────┐                       │
│         ▼                     ▼                     ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐                 │
│  │ READ Tools  │    │WRITE Tools  │    │  EXEC Tools     │                 │
│  │             │    │             │    │                 │                 │
│  │• fetchAsset │    │• createWf  │    │• runWorkflow   │                 │
│  │• fetchRuns  │    │• addScene  │    │• startExport   │                 │
│  │• getStatus  │    │• updateNode│    │• verifyResult │                 │
│  │• search     │    │• delete    │    │• retry        │                 │
│  └─────────────┘    └─────────────┘    └─────────────────┘                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Application API                                    │
│  /projects → /workflows → /nodes → /runs → /assets → /outputs → /exports   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Context Engine (NEW)

Fetches and indexes project content for RAG-style retrieval.

**Responsibilities:**

- Fetch project data: assets, workflows, runs, outputs
- Index content for semantic search
- Retrieve relevant context based on query
- Handle @mentions for explicit context
- Manage conversation history

**Context Types:**

| Context Type      | Source                    | Use For                          |
| ----------------- | ------------------------- | -------------------------------- |
| **Project State** | `/projects/:id`           | Understanding what's available   |
| **Assets**        | `/projects/:id/assets`    | Listing scenes, shots, sources   |
| **Workflows**     | `/projects/:id/workflows` | Understanding existing workflows |
| **Recent Runs**   | `/projects/:id/runs`      | Execution history, errors        |
| **Selected Item** | Store                     | Current focus                    |
| **Conversation**  | In-memory                 | Maintaining dialog               |
| **@mentions**     | User input                | Explicit context                 |

**Implementation:**

```typescript
interface CopilotContext {
  project: Project;
  assets: Asset[];
  workflows: Workflow[];
  runs: WorkflowRun[];
  selection: {
    workflowId?: string;
    assetId?: string;
    nodeId?: string;
  };
  conversation: ChatMessage[];
}

class ContextEngine {
  async buildContext(projectId: string, query: string): Promise<string> {
    // 1. Fetch all project data in parallel
    const [project, assets, workflows, runs] = await Promise.all([
      fetchProject(projectId),
      fetchProjectAssets(projectId),
      fetchProjectWorkflows(projectId),
      fetchProjectRuns(projectId),
    ]);

    // 2. Retrieve relevant items based on query
    const relevant = this.retrieve(query, { assets, workflows, runs });

    // 3. Format as context string
    return this.formatContext({
      project,
      assets: relevant.assets,
      workflows: relevant.workflows,
      runs: relevant.runs,
    });
  }

  retrieve(query: string, data: ContextData): RetrievalResult {
    // RAG-like retrieval
    // - Semantic search on titles/content
    // - Keyword matching
    // - Recent items priority
  }
}
```

### 2. Copilot Controller

The main orchestration layer that coordinates all components.

**Responsibilities:**

- Session management: Maintain conversation context across messages
- Request routing: Direct user requests to Planner or Direct Action
- Permission escalation: Require confirmation for destructive actions
- Rate limiting: Throttle actions to prevent abuse
- Audit logging: Log all actions for debugging and compliance
- User confirmation flow: Ask user before executing multi-step plans

**State Machine:**

```
IDLE → PLANNING → CONFIRMING → EXECUTING → COMPLETED/FAILED
         │            │            │
         │            │            └── Confirm required?
         │            └── Ask user: "Ready to proceed?"
         └── LLM generates execution plan
```

**Modes:**

- **Chat Mode**: Simple Q&A, immediate responses (current)
- **Agent Mode**: Autonomous planning + execution (future)

### 3. Planner (LLM-based)

Decomposes complex user requests into executable steps.

**Input:**

- User request
- Context from Context Engine
- Available tools/skills

**Output:**

```json
{
  "steps": [
    { "id": 1, "tool": "createWorkflow", "params": { "template": "music_video" } },
    { "id": 2, "tool": "addScenes", "params": { "count": 5 } },
    { "id": 3, "tool": "generateShots", "params": { "scenes": ["beach", "sunset"] } },
    { "id": 4, "tool": "runWorkflow", "params": { "workflow_id": "{{step1}}" } }
  ],
  "estimated_time": "2-3 minutes",
  "requires_confirmation": true
}
```

**Prompt Example:**

```
You are a video production planner. Given a user request and available tools,
create an execution plan.

Available Tools:
- createWorkflow(template): Creates a workflow
- addScenes(count, themes): Adds scenes to project
- generateShots(scene_ids): Generates shot plans
- runWorkflow(workflow_id): Executes a workflow
- createOutput(config): Creates output configuration

User: "Create an MV for my Madonna-style song"

Generate a JSON execution plan with steps to complete this request.
```

### 4. Tool Executor

Executes tools in sequence or parallel, handles dependencies.

**Responsibilities:**

- Tool invocation (calls skills)
- API calls to backend
- Result aggregation
- Error handling with retry
- Verification of results

**Execution Flow:**

```
1. Receive execution plan
2. For each step:
   a. Check dependencies (wait if needed)
   b. Execute tool
   c. Verify result (if failed, retry or continue)
   d. Store output for next steps
3. Aggregate all results
4. Return to user
```

**Verification:**

- After each tool execution, verify the result
- If verification fails, attempt to fix (retry, alternative tool)
- Report failures to user with options

### 5. Task Queue

Manages execution of planned steps with queuing and prioritization.

**Task States:**

```
pending → scheduled → running → completed
                   → failed → retry (max 3)
                         → cancelled
```

**Features:**

- FIFO execution with priority override
- Max concurrent tasks (configurable, default: 3)
- Task dependencies (step 2 needs step 1 complete)
- Persistence (survive app restart)

### 6. State Manager

Tracks task execution state, progress, and handles retries.

**Responsibilities:**

- Real-time progress tracking
- Error handling and retry logic
- State persistence (database)
- Progress broadcasting to UI via WebSocket

### 7. Scheduler

Handles delayed tasks, cron jobs, and retry logic.

**Features:**

- Delayed execution (e.g., "remind me in 1 hour")
- Periodic tasks (e.g., daily asset cleanup)
- Retry with exponential backoff

### 8. API Client

Unified interface to application backend.

**Capabilities:**

- REST API calls
- WebSocket for real-time updates
- Authentication handling
- Response parsing

### 9. LLM Client

Interface to LLM for planning and conversation.

**Features:**

- Model selection (gemma, claude, etc.)
- Streaming support
- Context management
- Error handling

---

## Tool System (15+ Tools)

Tools are the atomic capabilities the Copilot can execute, categorized by function.

### READ Tools

| Tool             | Description          | Parameters        |
| ---------------- | -------------------- | ----------------- |
| `fetchProject`   | Get project info     | -                 |
| `fetchAssets`    | List project assets  | `type`, `filters` |
| `fetchWorkflows` | List workflows       | -                 |
| `fetchWorkflow`  | Get workflow details | `workflow_id`     |
| `fetchRuns`      | List run history     | `workflow_id`     |
| `fetchRunStatus` | Get run status       | `run_id`          |
| `fetchOutputs`   | List outputs         | -                 |
| `searchAssets`   | Search assets        | `query`, `type`   |

### WRITE Tools

| Tool              | Description         | Parameters                         |
| ----------------- | ------------------- | ---------------------------------- |
| `createWorkflow`  | Create new workflow | `template`, `title`, `description` |
| `updateWorkflow`  | Update workflow     | `workflow_id`, `nodes`, `edges`    |
| `deleteWorkflow`  | Delete workflow     | `workflow_id`                      |
| `addScene`        | Add scenes          | `count`, `titles`                  |
| `updateScene`     | Update scene        | `scene_id`, `content`              |
| `deleteAsset`     | Delete asset        | `asset_id`                         |
| `createOutput`    | Create output       | `type`, `config`                   |
| `configureOutput` | Configure output    | `output_id`, `scenes`              |

### EXEC Tools

| Tool           | Description       | Parameters              |
| -------------- | ----------------- | ----------------------- |
| `runWorkflow`  | Execute workflow  | `workflow_id`, `inputs` |
| `startExport`  | Start export      | `output_id`             |
| `cancelExport` | Cancel export     | `export_id`             |
| `verifyResult` | Verify result     | `task_id`, `expected`   |
| `retryTask`    | Retry failed task | `task_id`               |

### Adding New Tools

```typescript
// frontend/src/lib/agent/tools/myTool.ts
import type { Tool, ToolContext, ToolResult } from '../types';

export const myTool: Tool = {
  name: 'myTool',
  description: 'Description of what it does',
  category: 'read', // 'read' | 'write' | 'exec'
  parameters: {
    param1: { type: 'string', required: true },
    param2: { type: 'number', required: false },
  },

  async execute(context: ToolContext, params: Params): Promise<ToolResult> {
    // Implementation
    return {
      success: true,
      message: 'Action completed!',
      data: { ... }
    };
  }
};
```

---

## Multi-Agent Orchestration (Future)

Similar to Cursor's research, we can support multiple agents working in parallel.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT ORCHESTRATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Root Planner                                                            │
│  ───────────                                                            │
│  • Owns entire scope of user instructions                               │
│  • Understands current state                                            │
│  • No execution itself - delegates                                      │
│         │                                                                │
│         ▼                                                                │
│  Sub-planners (spawns multiple)                                         │
│  ───────────────                                                        │
│  • Own narrow delegated slices                                          │
│  • Fully owns their scope                                                │
│         │                                                                │
│         ▼                                                                │
│  Workers (parallel)                                                     │
│  ────────                                                               │
│  • Drive tasks to completion                                            │
│  • Unaware of larger context                                            │
│  • Isolated task context                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## MCP (Model Context Protocol) (Future)

Connect to external video production tools.

```
AI Agent ←(MCP)→ External Services
                ├── Render Farms (local/cloud)
                ├── Stock Media APIs
                ├── Video Editors
                ├── Color Grading Tools
                └── Audio Processing
```

---

## Execution Isolation

Prevent tasks from interfering with each other.

- Each task runs in isolation
- Shared resources (project state) accessed sequentially
- Idempotent operations where possible
- Rollback capability for failed operations

---

## Conversation Flow

### Simple Request (Direct Action)

```
User:  "Add a new scene"
       │
       ▼
Context Engine fetches project state
       │
       ▼
Planner determines direct tool call
       │
       ▼
Executor runs addScene tool
       │
       ▼
Response: "Created Scene 5. Would you like to add content to it?"
```

### Complex Request (Plan + Confirm)

```
User:  "Create an MV for my Madonna-style song"
       │
       ▼
Context Engine gathers project context
       │
       ▼
Planner LLM generates plan
       │
       ▼
Plan:
  1. createWorkflow (template: music_video)
  2. addScenes (count: 5, themes: beach, sunset, dance)
  3. generateShots (scenes: all)
  4. configureOutput (resolution: 1080p)
  5. runWorkflow (workflow_id: step1)
       │
       ▼
Controller asks confirmation:
"I can create a music video workflow with 5 scenes and shots.
This will take ~2 minutes. Proceed?"
       │
       ▼
User: "Yes"
       │
       ▼
Executor runs steps (with progress updates)
       │
       ▼
Response: "Done! Created workflow with 5 scenes and 15 shot plans.
Run it now to generate your MV?"
```

### Agent Mode (Autonomous)

```
User:  "Create and run a music video for my song"
       │
       ▼
Context Engine gathers context
       │
       ▼
Planner generates full plan with execution
       │
       ▼
Auto-execute without confirmation (if trusted)
       │
       ▼
Executor runs each step, verifies result
       │
       ▼
Progress updates streamed to UI
       │
       ▼
Final result: "Your MV is ready! View it here..."
```

---

## State Persistence

Tasks and execution state are persisted to database for:

- Recovery after app restart
- Audit trail
- User history

```sql
-- copilot_sessions
- id: string
- project_id: string
- messages: json
- context: json
- created_at: timestamp

-- copilot_tasks
- id: string
- session_id: string
- step_number: integer
- tool: string
- params: json
- status: pending/running/completed/failed
- result: json
- error: string
- created_at: timestamp
- completed_at: timestamp

-- copilot_context_cache
- id: string
- project_id: string
- context_type: string
- content: json
- indexed_at: timestamp
```

---

## Security & Safety

### Permission Levels

| Level     | Actions                | Example                |
| --------- | ---------------------- | ---------------------- |
| `read`    | Fetch data, query      | "Show me my scenes"    |
| `write`   | Create, update         | "Add a new scene"      |
| `execute` | Run workflows, exports | "Generate the video"   |
| `delete`  | Destructive actions    | "Delete this workflow" |

### Confirmation Requirements

- `delete` actions always require confirmation
- `execute` actions require confirmation for long-running tasks
- First `execute` in session requires confirmation
- User can enable "Agent Mode" to skip confirmations

### Rate Limits

- Max 10 requests per minute per user
- Max 3 concurrent executing tasks
- Exponential backoff on failures

---

## Implementation Plan

### Phase 1: Foundation (Current)

- [x] Copilot Controller (basic orchestration)
- [x] Simple intent parser (existing regex-based)
- [x] 2-3 core skills (createWorkflow, addScene, fetchAssets)
- [x] Basic conversation flow

### Phase 2: Context Engine

- [ ] Context Engine with RAG
- [ ] Fetch project, assets, workflows, runs
- [ ] @mentions support
- [ ] Conversation history management

### Phase 3: Tool System Expansion

- [ ] Expand to 15+ tools
- [ ] Tool definitions with parameters
- [ ] Parallel tool execution
- [ ] Tool result verification

### Phase 4: Planner + Execution

- [ ] LLM-based planner
- [ ] Execution plan generation
- [ ] User confirmation flow
- [ ] Task queue basics

### Phase 5: Full Execution

- [ ] Task queue with persistence
- [ ] State manager
- [ ] Progress tracking
- [ ] WebSocket updates

### Phase 6: Advanced (Future)

- [ ] Multi-agent orchestration
- [ ] MCP integration
- [ ] Agent Mode
- [ ] Feedback loop learning

---

## First Concrete Copilot Use Case (MVP): Shot Image Prompt Copilot

To start with a bounded, high-signal feature, the first copilot capability should focus on **improving shot image prompts** (per shot, per scene, within a shot plan).

Why this first:

- Clear success criteria (the generated image matches the intended shot)
- Minimal destructive actions (mostly “write a prompt, save a version”)
- Uses existing context sources (canon, scenes, shot plan)
- Fits naturally in the existing Shots UI (selection + preview + generation)

Design details and proposed data model live in:

- `docs/copilot_shot_prompt_design.md`
