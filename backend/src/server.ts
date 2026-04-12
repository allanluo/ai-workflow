import { findStaleWorkflowRuns, recoverStaleWorkflowRun } from '@ai-workflow/database';
import { buildApp } from './app.js';
import { config } from './config.js';
import { createDiagnosticsLogger } from './runtime/diagnostics.js';

const diag = createDiagnosticsLogger(config.logging.diagnostics_path ?? undefined);

async function recoverInterruptedRuns(log: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
}) {
  const staleRuns = findStaleWorkflowRuns();

  if (staleRuns.length === 0) {
    log.info('No interrupted workflow runs to recover');
    diag.info('startup', 'No interrupted workflow runs to recover');
    return;
  }

  log.warn(`Found ${staleRuns.length} interrupted workflow run(s), marking as failed`);
  diag.warn('startup', `Found ${staleRuns.length} interrupted workflow run(s), marking as failed`);

  for (const run of staleRuns) {
    recoverStaleWorkflowRun(run.id, 'Server was restarted while workflow was running');
    log.info(`Recovered workflow run: ${run.id}`);
    diag.info('recovery', `Recovered workflow run: ${run.id}`, {
      workflow_run_id: run.id,
      project_id: run.project_id,
    });
  }
}

const app = await buildApp();

await recoverInterruptedRuns(app.log);

try {
  await app.listen({
    host: '127.0.0.1',
    port: config.port,
  });
  diag.info('startup', `Server listening on port ${config.port}`);
} catch (error) {
  diag.error('startup', 'Server failed to start', { error: String(error) });
  app.log.error(error);
  process.exit(1);
}
