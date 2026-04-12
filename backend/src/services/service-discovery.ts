import http from "node:http";
import { config } from "../config.js";

export interface ServiceHealth {
  available: boolean;
  endpoint: string;
  latency_ms: number;
  error?: string;
  details?: {
    ollama?: boolean;
    comfyui?: boolean;
  };
}

export interface LocalAIAPIHealth {
  available: boolean;
  endpoint: string;
  latency_ms: number;
  error?: string;
  details?: {
    ollama: boolean;
    comfyui: boolean;
  };
}

async function checkHealth(
  endpoint: string,
  timeoutMs: number = 2000
): Promise<ServiceHealth> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        available: false,
        endpoint,
        latency_ms: timeoutMs,
        error: "Service health check timed out"
      });
    }, timeoutMs);

    http
      .get(endpoint, (res) => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        let details: { ollama?: boolean; comfyui?: boolean } | undefined;

        if (res.statusCode === 200) {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              details = {
                ollama: parsed.ollama,
                comfyui: parsed.comfyui
              };
            } catch {
              // Ignore parse errors
            }
          });
        }

        resolve({
          available: res.statusCode === 200,
          endpoint,
          latency_ms: latency,
          error: res.statusCode !== 200 ? `HTTP ${res.statusCode}` : undefined,
          details
        });
      })
      .on("error", (error) => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        resolve({
          available: false,
          endpoint,
          latency_ms: latency,
          error: error instanceof Error ? error.message : String(error)
        });
      });
  });
}

export async function checkLocalAIService(): Promise<LocalAIAPIHealth> {
  const endpoint = `${config.localAIAPI.endpoint}/health`;
  const result = await checkHealth(endpoint, config.localAIAPI.health_check_timeout_ms);

  return {
    available: result.available,
    endpoint: result.endpoint,
    latency_ms: result.latency_ms,
    error: result.error,
    details: {
      ollama: result.details?.ollama ?? false,
      comfyui: result.details?.comfyui ?? false
    }
  };
}

let cachedHealth: LocalAIAPIHealth | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 30000;

export function getLocalAIServiceHealth(maxAgeMs: number = CACHE_TTL_MS): LocalAIAPIHealth | null {
  if (cachedHealth && Date.now() - cacheTimestamp < maxAgeMs) {
    return cachedHealth;
  }
  return null;
}

export function setLocalAIServiceHealth(health: LocalAIAPIHealth): void {
  cachedHealth = health;
  cacheTimestamp = Date.now();
}

export async function discoverServices(): Promise<{
  localAI: LocalAIAPIHealth;
}> {
  const health = await checkLocalAIService();
  setLocalAIServiceHealth(health);

  return {
    localAI: health
  };
}
