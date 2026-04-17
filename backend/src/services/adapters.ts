import { config } from "../config.js";

const BASE_URL = config.localAIAPI.endpoint;
const TIMEOUT_MS = config.localAIAPI.health_check_timeout_ms;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await globalThis.fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(`API Error ${response.status}: ${errorBody}`);
    }

    return response.json() as T;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

export interface LLMGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface LLMGenerateResponse {
  model: string;
  response: string;
}

export async function generateText(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
  return apiFetch<LLMGenerateResponse>("/api/llm/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface TTSGenerateRequest {
  text: string;
  template?: string;
  provider?: "piper" | "cosyvoice";
  speed?: number;
  volume?: number;
  prompt_text?: string;
  prompt_wav?: string;
  model_dir?: string;
}

export interface TTSGenerateResponse {
  job_id: string;
  status: string;
  audio_path: string;
  audio_url?: string;
  provider?: string;
}

export async function generateSpeech(request: TTSGenerateRequest): Promise<TTSGenerateResponse> {
  return apiFetch<TTSGenerateResponse>("/api/tts/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface ImageGenerateRequest {
  prompt: string;
  workflow?: string;
  width?: number;
  height?: number;
}

export interface ImageGenerateResponse {
  job_id: string;
  status: string;
  prompt_id: string;
  image_path?: string;
  image_url?: string;
  video_path?: string;
  video_url?: string;
}

export async function generateImage(request: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  return apiFetch<ImageGenerateResponse>("/api/image/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface VideoCreateRequest {
  prompt: string;
  workflow?: string;
  width?: number;
  height?: number;
}

export interface VideoCreateResponse {
  job_id: string;
  status: string;
  prompt_id: string;
  video_path?: string;
  video_url?: string;
}

export async function createVideo(request: VideoCreateRequest): Promise<VideoCreateResponse> {
  return apiFetch<VideoCreateResponse>("/api/video/create", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface VideoCreateFromImageRequest {
  prompt: string;
  workflow?: string;
  width?: number;
  height?: number;
  length?: number;
  reference_image: {
    bytes: ArrayBuffer;
    contentType: string;
    filename: string;
  };
}

export async function createVideoFromImage(
  request: VideoCreateFromImageRequest
): Promise<VideoCreateResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    form.append("prompt", request.prompt);
    if (request.workflow) form.append("workflow", request.workflow);
    if (typeof request.width === "number") form.append("width", String(request.width));
    if (typeof request.height === "number") form.append("height", String(request.height));
    if (typeof request.length === "number") form.append("length", String(request.length));

    const blob = new Blob([request.reference_image.bytes], {
      type: request.reference_image.contentType
    });
    form.append("reference_image", blob, request.reference_image.filename);

    const response = await globalThis.fetch(`${BASE_URL}/api/video/create-from-image`, {
      method: "POST",
      body: form,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(`API Error ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as VideoCreateResponse;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

export interface MusicGenerateRequest {
  text: string;
  prompt?: string;
  workflow?: string;
  duration_seconds?: number;
}

export interface MusicGenerateResponse {
  job_id: string;
  status: string;
  prompt_id: string;
  audio_path: string;
  audio_url?: string;
}

export async function generateMusic(request: MusicGenerateRequest): Promise<MusicGenerateResponse> {
  return apiFetch<MusicGenerateResponse>("/api/music/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface SoundGenerateRequest {
  prompt: string;
  workflow?: string;
  duration_seconds?: number;
  batch_size?: number;
  negative_prompt?: string;
}

export interface SoundGenerateResponse {
  job_id: string;
  status: string;
  prompt_id: string;
  audio_path: string;
  audio_url?: string;
}

export async function generateSound(request: SoundGenerateRequest): Promise<SoundGenerateResponse> {
  return apiFetch<SoundGenerateResponse>("/api/sound/generate", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface AvatarCreateRequest {
  name: string;
  voice: string;
  persona?: string;
  style?: string;
  appearance_prompt?: string;
  reference_strength?: number;
  generate_preview_audio?: boolean;
  reference_image?: string;
}

export interface AvatarRecord {
  avatar_id: string;
  name: string;
  status: string;
  voice: string;
  persona?: string;
  style?: string;
  appearance_prompt?: string;
  source_type: string;
  reference_image_path?: string;
  generated_image_path?: string;
  preview_audio_path?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface AvatarCreateResponse {
  job_id: string;
  status: string;
  avatar: AvatarRecord;
}

export async function createAvatar(request: AvatarCreateRequest): Promise<AvatarCreateResponse> {
  return apiFetch<AvatarCreateResponse>("/api/avatar/create", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface AvatarTalkRequest {
  text: string;
  voice?: string;
  speed?: number;
  captions?: boolean;
  animation_mode?: string;
}

export interface AvatarTalkResponse {
  job_id: string;
  status: string;
  avatar_id: string;
  audio_path: string;
  video_path?: string;
  animation_mode: string;
}

export async function talkAsAvatar(
  avatarId: string,
  request: AvatarTalkRequest
): Promise<AvatarTalkResponse> {
  return apiFetch<AvatarTalkResponse>(`/api/avatar/${avatarId}/talk`, {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface SlideshowCreateRequest {
  topic: string;
  host_style: string;
  scene_count?: number;
  voice: string;
  model: string;
}

export interface SlideshowCreateResponse {
  job_id: string;
  status: string;
  video_path?: string;
  video_url?: string;
}

export async function createSlideshow(request: SlideshowCreateRequest): Promise<SlideshowCreateResponse> {
  return apiFetch<SlideshowCreateResponse>("/api/slideshow/create", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export interface JobStatusResponse {
  job_id: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  artifacts?: Record<string, unknown>;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(`/api/jobs/${jobId}`);
}

export interface VoiceOption {
  id: string;
  label: string;
  path: string;
  provider?: string;
  language?: string;
}

export interface VoiceListResponse {
  voices: VoiceOption[];
}

export async function listVoices(): Promise<VoiceListResponse> {
  return apiFetch<VoiceListResponse>("/api/avatar/voices");
}

export async function getAvatar(avatarId: string): Promise<AvatarRecord> {
  return apiFetch<AvatarRecord>(`/api/avatar/${avatarId}`);
}
