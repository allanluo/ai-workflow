import path from 'node:path';

function parseSeed(value: string | undefined): number {
  if (value !== undefined) {
    const parsed = Number(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return 42;
}

export const config = {
  appName: 'ai-workflow-backend',
  appVersion: '0.1.0',
  port: Number(process.env.PORT ?? 8787),
  projectStorageRoot:
    process.env.PROJECT_STORAGE_ROOT ?? path.resolve(process.cwd(), 'storage/projects'),

  localAIAPI: {
    enabled: process.env.LOCAL_AI_API_ENABLED !== 'false',
    endpoint: process.env.LOCAL_AI_API_ENDPOINT ?? 'http://10.0.0.20:8001',
    health_check_timeout_ms: Number(process.env.LOCAL_AI_API_HEALTH_CHECK_TIMEOUT ?? 5000),
  },

  defaults: {
    llm_model: process.env.DEFAULT_LLM_MODEL ?? 'qwen3:8b',
    tts_voice: process.env.DEFAULT_TTS_VOICE ?? 'zero_shot_prompt.wav',
  },

  execution: {
    max_concurrent_jobs: Number(process.env.MAX_CONCURRENT_JOBS ?? 4),
    default_timeout_sec: Number(process.env.DEFAULT_EXECUTION_TIMEOUT ?? 300),
    retry_policy: (process.env.DEFAULT_RETRY_POLICY ?? 'fail_fast') as
      | 'fail_fast'
      | 'retry_3x'
      | 'retry_with_backoff',
  },

  determinism: {
    default_seed: parseSeed(process.env.DEFAULT_SEED),
    enforce_reproducibility: process.env.ENFORCE_REPRODUCIBILITY === 'true',
  },

  logging: {
    diagnostics_path: process.env.DIAGNOSTICS_LOG_PATH ?? null,
  },
} as const;

export type Config = typeof config;
