export interface ServiceAdapterDescriptor {
  name: string;
  capability: "text" | "image" | "video" | "speech" | "render";
}

export const serviceAdapters: ServiceAdapterDescriptor[] = [
  { name: "ollama_text_adapter", capability: "text" },
  { name: "comfyui_image_adapter", capability: "image" },
  { name: "comfyui_video_adapter", capability: "video" },
  { name: "tts_speech_adapter", capability: "speech" },
  { name: "ffmpeg_render_adapter", capability: "render" }
];
