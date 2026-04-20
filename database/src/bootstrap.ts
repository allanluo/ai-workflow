import { sqlite } from './client.js';

let initialized = false;

export function initializeDatabase() {
  if (initialized) {
    return;
  }

  doInitialize();
  initialized = true;
}

export function resetDatabase() {
  initialized = false;
  doInitialize();
}

function doInitialize() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      primary_output_type TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS file_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      asset_version_id TEXT,
      file_role TEXT NOT NULL,
      storage_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      asset_category TEXT NOT NULL,
      title TEXT,
      current_version_number INTEGER NOT NULL DEFAULT 0,
      current_asset_version_id TEXT,
      current_approved_asset_version_id TEXT,
      status TEXT NOT NULL,
      approval_state TEXT NOT NULL DEFAULT 'unapproved',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS asset_versions (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      previous_version_id TEXT,
      parent_asset_id TEXT,
      status TEXT NOT NULL,
      approval_state TEXT NOT NULL DEFAULT 'unapproved',
      source_mode TEXT NOT NULL,
      created_by TEXT,
      edited_by_last TEXT,
      workflow_version_id TEXT,
      workflow_run_id TEXT,
      node_run_id TEXT,
      content_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      locked_fields_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      template_type TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      defaults_json TEXT NOT NULL DEFAULT '{}',
      nodes_json TEXT NOT NULL DEFAULT '[]',
      edges_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS workflow_versions (
      id TEXT PRIMARY KEY,
      workflow_definition_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      graph_hash TEXT NOT NULL,
      template_type TEXT NOT NULL,
      frozen_workflow_json TEXT NOT NULL,
      input_asset_versions_json TEXT NOT NULL DEFAULT '{}',
      runtime_environment_json TEXT NOT NULL DEFAULT '{}',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_version_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      triggered_by TEXT,
      trigger_source TEXT NOT NULL,
      rerun_of_workflow_run_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      resolved_input_snapshot_json TEXT NOT NULL DEFAULT '{}',
      summary_json TEXT NOT NULL DEFAULT '{}',
      logs_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_runs (
      id TEXT PRIMARY KEY,
      workflow_run_id TEXT NOT NULL,
      workflow_version_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      status TEXT NOT NULL,
      position INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      input_snapshot_json TEXT NOT NULL DEFAULT '{}',
      output_snapshot_json TEXT NOT NULL DEFAULT '{}',
      logs_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      workflow_run_id TEXT,
      node_run_id TEXT,
      export_job_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
    CREATE INDEX IF NOT EXISTS idx_file_records_project_id ON file_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
    CREATE INDEX IF NOT EXISTS idx_asset_versions_asset_id ON asset_versions(asset_id);
    CREATE INDEX IF NOT EXISTS idx_asset_versions_project_id ON asset_versions(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_definitions_project_id ON workflow_definitions(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_definition_id ON workflow_versions(workflow_definition_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_id ON workflow_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_version_id ON workflow_runs(workflow_version_id);
    CREATE INDEX IF NOT EXISTS idx_node_runs_workflow_run_id ON node_runs(workflow_run_id);
    CREATE INDEX IF NOT EXISTS idx_project_events_project_id ON project_events(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_events_created_at ON project_events(created_at);

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      asset_version_id TEXT,
      node_run_id TEXT,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      parent_comment_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      asset_version_id TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      approver_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      output_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS output_versions (
      id TEXT PRIMARY KEY,
      output_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      assembled_from_asset_version_ids_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      output_version_id TEXT NOT NULL,
      export_format TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      output_path TEXT,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id);
    CREATE INDEX IF NOT EXISTS idx_comments_asset_version_id ON comments(asset_version_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_asset_id ON approvals(asset_id);
    CREATE INDEX IF NOT EXISTS idx_outputs_project_id ON outputs(project_id);
    CREATE INDEX IF NOT EXISTS idx_output_versions_output_id ON output_versions(output_id);
    CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id ON export_jobs(project_id);
    CREATE INDEX IF NOT EXISTS idx_export_jobs_output_version_id ON export_jobs(output_version_id);

    CREATE TABLE IF NOT EXISTS copilot_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      state_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_sessions_project_id ON copilot_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_sessions_updated_at ON copilot_sessions(updated_at);

    CREATE TABLE IF NOT EXISTS copilot_audit_events (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      event_type TEXT NOT NULL,
      tool TEXT,
      ok INTEGER,
      duration_ms INTEGER,
      summary TEXT,
      details_json TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_audit_events_project_id ON copilot_audit_events(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_audit_events_created_at ON copilot_audit_events(created_at);

    CREATE TABLE IF NOT EXISTS copilot_plan_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      plan_json TEXT NOT NULL DEFAULT '{}',
      context_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_plan_runs_project_id ON copilot_plan_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_plan_runs_updated_at ON copilot_plan_runs(updated_at);

    CREATE TABLE IF NOT EXISTS copilot_plan_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      step_id TEXT NOT NULL,
      title TEXT NOT NULL,
      tool TEXT NOT NULL,
      status TEXT NOT NULL,
      params_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '',
      error_json TEXT NOT NULL DEFAULT '',
      started_at TEXT,
      ended_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_plan_steps_run_id ON copilot_plan_steps(run_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_plan_steps_project_id ON copilot_plan_steps(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_plan_steps_updated_at ON copilot_plan_steps(updated_at);

    CREATE TABLE IF NOT EXISTS copilot_context_cache (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      content TEXT NOT NULL,
      indexed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_context_cache_project_id ON copilot_context_cache(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_context_cache_context_type ON copilot_context_cache(context_type);

    CREATE TABLE IF NOT EXISTS copilot_vector_index (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      context_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_version_id TEXT,
      chunk_id TEXT NOT NULL DEFAULT '0',
      chunk_index INTEGER NOT NULL DEFAULT 0,
      chunk_count INTEGER NOT NULL DEFAULT 1,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      embedding_json TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL DEFAULT '',
      source_updated_at TEXT NOT NULL DEFAULT '',
      indexed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_copilot_vector_index_project_id ON copilot_vector_index(project_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_vector_index_context_type ON copilot_vector_index(context_type);
    CREATE INDEX IF NOT EXISTS idx_copilot_vector_index_item_id ON copilot_vector_index(item_id);
    CREATE INDEX IF NOT EXISTS idx_copilot_vector_index_model ON copilot_vector_index(model);
  `);

  // Lightweight migrations for older databases created before chunked indexing existed.
  ensureCopilotVectorIndexChunkColumns();
}

export function getDatabaseStatus() {
  return {
    status: initialized ? ('connected' as const) : ('not_configured' as const),
    dialect: 'sqlite' as const,
  };
}

function ensureCopilotVectorIndexChunkColumns() {
  try {
    const cols = sqlite.prepare(`PRAGMA table_info(copilot_vector_index)`).all() as Array<{ name: string }>;
    const names = new Set(cols.map(c => c.name));
    const alters: string[] = [];
    if (!names.has('chunk_id')) alters.push(`ALTER TABLE copilot_vector_index ADD COLUMN chunk_id TEXT NOT NULL DEFAULT '0'`);
    if (!names.has('chunk_index')) alters.push(`ALTER TABLE copilot_vector_index ADD COLUMN chunk_index INTEGER NOT NULL DEFAULT 0`);
    if (!names.has('chunk_count')) alters.push(`ALTER TABLE copilot_vector_index ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 1`);
    for (const sql of alters) sqlite.exec(`${sql};`);
  } catch {
    // best-effort: ignore if PRAGMA not supported or table absent
  }
}
