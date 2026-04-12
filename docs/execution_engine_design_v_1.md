# Execution Engine and Job Orchestration Design v1

## 1. Purpose
Define how workflows are executed, scheduled, monitored, and controlled.

This layer turns a frozen workflow version into actual outputs.

---

## 2. Core Responsibilities
The execution engine must:
- execute workflow versions deterministically
- resolve node dependencies
- manage job queue and concurrency
- track progress and status
- record node-level execution
- handle failures and retries
- emit logs and events
- support partial reruns

---

## 3. Core Concepts

### 3.1 Workflow Run
A workflow run is a single execution instance.

### 3.2 Node Run
Each node execution within a workflow run.

### 3.3 Job
A unit of work scheduled for execution (often maps to a node run).

### 3.4 Executor
Service responsible for running jobs (LLM, image, video, etc.)

---

## 4. Execution Flow

1. User triggers run (or system trigger)
2. Engine loads WorkflowVersion
3. Resolve and persist exact input asset versions for dynamic queries
4. Build execution plan (topological order)
5. Enqueue first runnable nodes
6. Execute nodes when dependencies satisfied
7. Record NodeRun results
8. Continue until all nodes complete or failure condition met
9. Finalize WorkflowRun

---

## 5. Dependency Resolution

Execution order determined by:
- edges in workflow graph
- node enabled status

Nodes can run when:
- all upstream dependencies are completed
- no blocking failure occurred

---

## 6. Job Queue Model

### States
- queued
- running
- completed
- failed
- canceled

### Queue Requirements
- support concurrency limits
- support priority (future)
- support retry policies

---

## 7. Node Execution Lifecycle

1. Resolve inputs
2. Merge config (workflow defaults + node overrides)
3. Bind model/service
4. Execute task
5. Validate output (if applicable)
6. Persist outputs as assets
7. Record NodeRun

---

## 8. Retry and Failure Handling

Retry policies:
- fail_fast
- retry_n_times
- retry_with_backoff

Failure behavior:
- stop workflow
- skip node
- continue with warning

Defined per node.

---

## 9. Partial Rerun Model

Allow rerunning:
- a single node
- a node + downstream nodes

Rules:
- upstream nodes remain unchanged
- new outputs create new asset versions
- rerun must reference same workflow version
- rerun should reuse the source run's resolved input snapshot unless caller explicitly refreshes dynamic inputs

---

## 10. Progress Reporting

Engine should emit:
- workflow progress (percentage or stage-based)
- node-level status
- logs and warnings

Delivery:
- WebSocket or polling

For v1, the live stream should be backed by a persisted project event log so the UI can recover after reconnects.

---

## 11. Logging

Must capture:
- inputs used
- resolved config
- model calls
- outputs created
- errors

Logs should be queryable and tied to NodeRun.

---

## 12. Concurrency Model

Initial v1:
- sequential or limited parallel execution

Future:
- parallel branches
- distributed execution

---

## 13. Service Abstraction

Each node should call a service adapter:

Examples:
- llm_service
- image_service
- video_service
- tts_service
- render_service

Adapters hide implementation details.

---

## 14. Determinism Controls

Engine must enforce:
- seed usage
- model version binding
- parameter locking

---

## 15. Cancellation

User should be able to:
- cancel entire workflow run
- cancel specific node jobs (future)

---

## 16. Persistence

Store:
- workflow_runs
- node_runs
- job states
- logs
- resolved input snapshots
- project_events for replayable progress and activity history

---

## 17. Open Questions

1. How much parallelism to allow in v1?
2. Do we need priority queues early?
3. How to handle long-running video jobs?
4. How to unify local vs remote execution?
5. Should retries be automatic or user-triggered?
