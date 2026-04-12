import * as adapters from "../services/adapters.js";
import { getJobStatus, type JobStatusResponse } from "../services/adapters.js";

export interface JobPollerOptions {
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  onStatusChange?: (status: string, job: JobStatusResponse) => void;
}

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_POLL_ATTEMPTS = 300;

export async function pollJobUntilComplete(
  jobId: string,
  options: JobPollerOptions = {}
): Promise<JobStatusResponse> {
  const {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxPollAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
    onStatusChange
  } = options;

  let lastStatus = "";
  let attempts = 0;

  while (attempts < maxPollAttempts) {
    const job = await getJobStatus(jobId);

    if (job.status !== lastStatus) {
      lastStatus = job.status;
      onStatusChange?.(job.status, job);
    }

    if (job.status === "completed" || job.status === "failed" || job.status === "error") {
      return job;
    }

    await delay(pollIntervalMs);
    attempts++;
  }

  throw new Error(`Job ${jobId} polling timed out after ${maxPollAttempts} attempts`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function submitAndWaitForLLM(
  prompt: string,
  model: string,
  _options: JobPollerOptions = {}
): Promise<{ text: string; model: string }> {
  const response = await adapters.generateText({ model, prompt });
  return { text: response.response, model: response.model };
}

export async function submitAndWaitForTTS(
  text: string,
  template: string,
  options: JobPollerOptions = {}
): Promise<JobStatusResponse> {
  const response = await adapters.generateSpeech({ text, template });
  return pollJobUntilComplete(response.job_id, options);
}

export async function submitAndWaitForImage(
  prompt: string,
  width?: number,
  height?: number,
  options: JobPollerOptions = {}
): Promise<JobStatusResponse> {
  const response = await adapters.generateImage({ prompt, width, height });
  return pollJobUntilComplete(response.job_id, options);
}

export async function submitAndWaitForVideo(
  prompt: string,
  width?: number,
  height?: number,
  options: JobPollerOptions = {}
): Promise<JobStatusResponse> {
  const response = await adapters.createVideo({ prompt, width, height });
  return pollJobUntilComplete(response.job_id, options);
}
