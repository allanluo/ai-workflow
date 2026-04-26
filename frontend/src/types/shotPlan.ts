import { z } from 'zod';

/**
 * Shot Definition
 * Represents a single camera setup or story beat.
 */
export const ShotSchema = z.object({
  id: z.string().optional(),
  shot: z.union([z.string(), z.number()]).optional(), // New standard (from user request)
  shotNumber: z.union([z.string(), z.number()]).optional(), // Backwards compatibility
  action: z.string().optional().describe("Primary visual description"),
  description: z.string().optional().describe("Legacy visual description"),
  narration: z.string().optional(),
  internal_monologue: z.string().optional(),
  dialogue: z.string().optional(),
  characters: z.array(z.string()).optional(),
  environment: z.string().optional(),
  props: z.array(z.string()).optional(),
  framing: z.string().optional(),
  angle: z.string().optional(),
  motion: z.string().optional(),
  continuity_notes: z.string().optional(),
  continuityNotes: z.string().optional(),
  frame_prompt: z.string().optional().describe("Image generation specific prompt"),
  video_prompt: z.string().optional().describe("Video generation specific prompt"),
  // App-internal generation metadata
  image: z.object({
    prompt: z.string().optional(),
    negative_prompt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional(),
});

/**
 * Scene Definition
 * Groups shots and provides environmental context.
 */
export const SceneSchema = z.object({
  scene: z.number().optional(), // New standard numbering
  title: z.string().optional(), // Legacy title
  description: z.string().optional(), // Scene-level summary
  purpose: z.string().optional(),
  emotional_beat: z.string().optional(),
  emotionalBeat: z.string().optional(),
  setting: z.string().optional(),
  shot_count: z.number().optional(),
  shots: z.array(ShotSchema).optional(),
});

/**
 * Root Shot Plan Schema
 * Matches the user proposed "Advanced Music Video" structure.
 */
export const ShotPlanSchema = z.object({
  title: z.string().optional(),
  source_summary: z.string().optional(),
  environment_lock: z.string().optional(),
  character_table: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    gender: z.string().optional(),
    age: z.string().optional(),
    character_image: z.string().optional(),
    facial_features: z.string().optional(),
    dress: z.string().optional(),
    shoes: z.string().optional(),
    hat: z.string().optional(),
  })).optional(),
  scenes: z.array(SceneSchema).optional(),
  shots: z.array(ShotSchema).optional(), // Fallback for simple flat lists
});

export type ShotPlan = z.infer<typeof ShotPlanSchema>;
export type ShotPlanScene = z.infer<typeof SceneSchema>;
export type ShotPlanShot = z.infer<typeof ShotSchema>;
