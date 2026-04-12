# Implementation Gap Analysis

## Purpose

This document captures the gaps between the current codebase and the expectations described in:

- `docs/implementation_plan_v_1.md`
- `docs/implementation_plan_v_2.md`
- `docs/workflow_master_design_v_1.md`
- `docs/workflow_implementation_plan_v_1.md`

It is intended as a working review artifact, not a replacement for the implementation plans.

For workflow-specific product and engineering direction, the current source of truth should now be:

- `docs/workflow_master_design_v_1.md`
- `docs/workflow_implementation_plan_v_1.md`

`implementation_plan_v_1.md` remains the original full-product plan.
`implementation_plan_v_2.md` should be treated as a repo-state gap tracker and secondary execution guide, not the primary workflow design document.

---

## Verification Summary

The following checks were run against the current repository state:

- `pnpm -r typecheck` -> passes
- `pnpm --filter @ai-workflow/backend test` -> passes
- `pnpm --filter @ai-workflow/database test` -> passes
- `pnpm -r test` -> fails because `@ai-workflow/services` defines `vitest run` but has no test files

---

## P0 Gaps

These gaps affect core correctness or break documented product flows.

### 1. Asset links and tags are not bootstrapped in the database

- `backend/src/routes/links.ts` exposes asset link and tag endpoints
- `database/src/schema.ts` defines `asset_links` and `asset_tags`
- `database/src/bootstrap.ts` does not create those tables

Impact:

- link/tag endpoints fail on a clean database
- v2 understates the issue as a remaining feature gap, but the code is partially implemented and runtime-broken

### 2. Review approval flow does not actually approve assets

- `frontend/src/pages/ReviewTab.tsx` posts to `/projects/:projectId/assets/:assetId/approve`
- `backend/src/routes/reviews.ts` records an approval entry
- `database/src/reviews.ts` inserts approval history only
- the actual asset state transition is implemented separately in `backend/src/routes/assets.ts` and `database/src/assets.ts`

Impact:

- approving from the review UI does not reliably move an asset from unapproved to approved
- the v1 review/approval loop is not complete end to end

### 3. Frontend API usage is inconsistent and breaks under the default dev setup

- most frontend requests use `frontend/src/lib/api.ts`
- `frontend/src/pages/ReviewTab.tsx` and `frontend/src/pages/OutputsTab.tsx` use relative `/api/v1/...` paths directly
- `frontend/vite.config.ts` has no dev proxy

Impact:

- those pages can call the wrong origin during local development
- some UI flows work differently from the rest of the app

### 4. v1 definition of done is not yet satisfied

Per `docs/implementation_plan_v_1.md`, v1 requires:

- review and approval flow
- output version creation
- export request and monitoring
- reopening the project and inspecting full history

Current status:

- parts of the backend exist
- the frontend loop is incomplete and partly mock-backed
- the documented full loop is not yet operational

---

## P1 Gaps

These gaps do not always break boot, but they block accurate product behavior or make the plans misleading.

### 5. Workflow runs are not correctly attached to workflows in the UI

- `frontend/src/pages/WorkflowsTab.tsx` filters runs with `workflow_version_id.includes(workflow.id)`

Impact:

- workflow cards can fail to show their run history or active status
- users cannot reliably inspect workflow activity from the main workflow surface

### 6. Route structure in v2 does not match the actual app

`docs/implementation_plan_v_2.md` says:

- `/projects/:projectId` redirects to `/sources`
- `/projects/:projectId/exports` exists

Actual code in `frontend/src/App.tsx`:

- `/projects/:projectId` renders `ProjectDetailPage`
- `/projects/:projectId/exports` is not routed
- `/projects/:projectId/compare` exists but is not documented in the v2 route section

Impact:

- the plan is not reliable for implementation or QA
- anyone using the doc as the source of truth will test the wrong routes

### 7. Outputs and export flow is only partially integrated

- outputs can be listed and created from `frontend/src/pages/OutputsTab.tsx`
- export creation mutation exists in the same file
- output-version assembly is not presented as a real end-user flow
- the overall preview/export loop described in v1 is not integrated cleanly in the UI

Impact:

- the output/export milestone is only partially complete
- the documented milestone completion criteria are not met

### 8. Validation result persistence is still missing

`docs/implementation_plan_v_1.md` calls for:

- validation endpoints
- `validation_results` database support
- validation result persistence and UI

Current status:

- workflow validation exists as a computed API response
- no `validation_results` table or persistence layer exists

Impact:

- validation history is not preserved
- the implementation does not match the v1 milestone scope

### 9. Generation observability is still missing

v2 lists generation records and service-call logging as remaining backend work.

Current status:

- diagnostics logging exists
- no dedicated generation records or service-call persistence was found

Impact:

- runtime observability is weaker than the design/plan expects
- debugging and auditability are limited

---

## P2 Gaps

These gaps are mostly about implementation maturity and documentation accuracy.

### 10. Several major frontend surfaces exist only as scaffolds or mock-backed placeholders

The following files exist but still use mock data or placeholder behavior:

- `frontend/src/pages/ShotsPage/ShotsPage.tsx`
- `frontend/src/pages/TimelinePage/TimelinePage.tsx`
- `frontend/src/pages/ActivityPage/ActivityPage.tsx`
- `frontend/src/components/diff/DiffViewer.tsx`
- `frontend/src/components/shell/VersionsPanel.tsx`
- `frontend/src/components/shell/CommentsPanel.tsx`
- `frontend/src/components/shell/ValidationPanel.tsx`
- `frontend/src/components/shell/GlobalSearch.tsx`

Impact:

- v2 describes many of these pages as missing, but they are actually scaffolded and not integrated
- the real remaining work is data integration and behavior completion, not file creation

### 11. v2 file inventory is stale

`docs/implementation_plan_v_2.md` lists many files under "New Files" that already exist, including:

- shell components
- diff components
- stores
- shots/timeline/activity page files

Impact:

- the plan invites duplicate work
- it obscures the difference between "not started" and "started but incomplete"

### 12. v2 backend gap list is partially outdated

`docs/implementation_plan_v_2.md` lists node-level rerun as missing.

Actual status:

- `POST /node-runs/:nodeRunId/rerun` already exists in `backend/src/routes/workflows.ts`

Impact:

- the document is not a dependable status tracker

### 13. Root test workflow is not production-ready

- root `package.json` runs `pnpm -r test`
- `services/package.json` defines a test command without any test files

Impact:

- repository-level test execution fails even though backend/database tests pass
- CI quality signals are weaker than the plans imply

---

## Recommended Cleanup of the Planning Docs

The implementation plans should be updated to distinguish these three states:

1. Implemented and working
2. Implemented but incomplete or mock-backed
3. Not started

In particular, `docs/implementation_plan_v_2.md` should be revised to:

- remove already-created files from "New Files"
- mark shell/stores/shots/timeline/activity/diff as scaffolded rather than missing
- remove node rerun from the missing-backend list
- add the real broken items:
  - missing `asset_links` / `asset_tags` DB bootstrap
  - broken review approval integration
  - inconsistent frontend API base URL usage
  - incomplete output/export flow

In addition, the planning docs should clearly separate:

1. Workflow source of truth
   - `docs/workflow_master_design_v_1.md`
   - `docs/workflow_implementation_plan_v_1.md`

2. Whole-product historical plan
   - `docs/implementation_plan_v_1.md`

3. Current repo-state gap tracker
   - `docs/implementation_plan_v_2.md`
   - `docs/implementation_gap_analysis.md`

---

## Suggested Next Work Order

1. Fix broken runtime issues first:
   - DB bootstrap for links/tags
   - approval flow integration
   - frontend API base URL consistency

2. Fix inaccurate wiring next:
   - workflow run association in the workflows page
   - outputs/export integration
   - route/documentation alignment

3. Replace mock-backed UI surfaces with real data:
   - activity
   - shots
   - timeline
   - diff
   - right-panel tabs

4. Update planning docs after the above are clarified:
   - refresh v2 as a true gap tracker that points workflow work to the dedicated workflow docs
   - keep v1 as the original target doc

---

## Milestone 1 Checklist

Reference: `docs/implementation_plan_v_1.md`, Milestone 1 "Core Project, Asset, and Workflow Authoring".

### Done

- Projects CRUD
  - backend routes exist for create/list/get/update/archive
  - project persistence exists in the database bootstrap and data layer
  - backend tests cover project CRUD behavior

- File upload API and file metadata records
  - backend multipart upload route exists
  - file metadata is persisted in `file_records`
  - file retrieval/content endpoints exist

- Asset families and asset versions
  - asset creation, listing, retrieval, update, version listing, and new-version creation exist
  - `assets` and `asset_versions` tables exist
  - versioned asset shape includes current version and current approved version pointers

- Workflow definitions and workflow versions
  - workflow create/list/get/update routes exist
  - workflow validation route exists
  - workflow version creation and listing routes exist
  - `workflow_definitions` and `workflow_versions` tables exist

- Approval-ready workflow validation
  - workflow validation endpoint exists
  - workflow validation tests exist

- Source, canon, and scenes UI surfaces
  - `SourcesTab`, `CanonTab`, and `ScenesTab` exist
  - project home and shell-level routing exist

- Early rule coverage in backend logic
  - current working version vs current approved version behavior exists for assets
  - workflow draft vs frozen workflow version separation exists
  - asset approval state is separate from asset lifecycle status

### Partial

- Upload source files as a usable Milestone 1 UI flow
  - upload endpoint exists and the frontend can submit files
  - but the Sources page renders source assets, not file records
  - uploaded files are therefore not properly surfaced in the main source intake UI

- Workflows page for simple/guided draft editing
  - workflow list/create/run behavior exists
  - but there is not yet a meaningful draft-editing surface for nodes/edges/defaults beyond basic creation

- Reusable list/detail patterns for assets and workflows
  - list views and some detail panels exist
  - coverage is uneven and not all milestone surfaces have a true list/detail editing experience

- Testing for Milestone 1 invariants
  - asset version creation, approval behavior, workflow validation, and workflow version behavior are covered
  - file upload/file intake does not appear to have dedicated backend test coverage

### Missing

- Asset lock endpoint
  - the milestone explicitly calls for asset approval and lock endpoints
  - lock-related fields/status exist in the model
  - no dedicated asset lock route was found

### Milestone 1 Verdict

Milestone 1 is mostly implemented at the backend and schema level, but only partially complete as an end-user slice.

The milestone should be treated as:

- backend/data model: substantially complete
- frontend/product flow: partially complete
- overall milestone status: partial
