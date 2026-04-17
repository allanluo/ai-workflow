export type WorkflowNodeCategory =
  | 'input'
  | 'planning'
  | 'generation'
  | 'validation'
  | 'assembly'
  | 'export';

export interface WorkflowCatalogNodeDefinition {
  key: string;
  runtimeType: string;
  category: WorkflowNodeCategory;
  title: string;
  description: string;
  defaultLabel: string;
  inputSummary: string;
  outputSummary: string;
  defaultParams: Record<string, unknown>;
  defaultData?: Record<string, unknown>;
}

export interface WorkflowTemplateDefinition {
  id: string;
  title: string;
  description: string;
  templateType: string;
  mode: 'simple' | 'guided' | 'advanced';
  defaults: Record<string, unknown>;
  metadata: Record<string, unknown>;
  nodes: Array<{
    id: string;
    nodeKey: string;
    label?: string;
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export const workflowNodeCatalog: WorkflowCatalogNodeDefinition[] = [
  {
    key: 'story_input',
    runtimeType: 'input',
    category: 'input',
    title: 'Story Input',
    description: 'A typed story, treatment, or creative brief that starts the workflow.',
    defaultLabel: 'Story Input',
    inputSummary: 'Manual text',
    outputSummary: 'story_text',
    defaultParams: {
      text: '',
    },
  },
  {
    key: 'prompt_input',
    runtimeType: 'input',
    category: 'input',
    title: 'Prompt Input',
    description: 'A direct prompt used to drive later planning or generation steps.',
    defaultLabel: 'Prompt Input',
    inputSummary: 'Manual prompt',
    outputSummary: 'prompt_text',
    defaultParams: {
      text: '',
    },
  },
  {
    key: 'instructions_input',
    runtimeType: 'input',
    category: 'input',
    title: 'Instructions Input',
    description: 'Reusable guidance or production rules typed directly by the user.',
    defaultLabel: 'Instructions Input',
    inputSummary: 'Manual instructions',
    outputSummary: 'instruction_text',
    defaultParams: {
      text: '',
    },
  },
  {
    key: 'extract_canon',
    runtimeType: 'llm_text',
    category: 'planning',
    title: 'Extract Canon',
    description:
      'Turns source material into reusable canon such as characters, world rules, and style hints.',
    defaultLabel: 'Extract Canon',
    inputSummary: 'story_text',
    outputSummary: 'canon_bundle',
    defaultParams: {
      prompt: `Extract canon from the source material. Output ONLY valid JSON (no markdown, no explanation, no text before or after):

{
  "summary": "2-3 sentence overview of the story",
  "themes": ["theme1"],
  "tone": "overall tone",
  "colorPalette": ["dominant colors"],
  "worldRules": ["rule"],
  "characters": [{
    "name": "name",
    "role": "protagonist/antagonist/supporting",
    "description": "brief description",
    "appearance": {"face": "features", "hair": "style", "clothing": "outfit", "shoes": "footwear", "hat": "headwear", "accessories": "items"},
    "personality": "key traits",
    "relationships": [{"to": "other character", "type": "friend/enemy/family"}]
  }],
  "locations": [{
    "name": "name",
    "description": "visual description",
    "mood": "atmosphere"
  }],
  "equipment": [{
    "name": "item name",
    "description": "description",
    "owner": "character name"
  }]
}`,
      model: 'gemma3:1b',
    },
  },
  {
    key: 'generate_scenes',
    runtimeType: 'llm_text',
    category: 'planning',
    title: 'Generate Scenes',
    description:
      'Breaks the source and canon into a scene outline suitable for later shot planning.',
    defaultLabel: 'Generate Scenes',
    inputSummary: 'story_text + canon_bundle',
    outputSummary: 'scene_outline',
    defaultParams: {
      prompt: `Generate a clear scene outline from the story and canon. Output ONLY valid JSON (no markdown, no explanation, no text before or after). The JSON should conform to the following schema:
{
  "scenes": [
    {
      "title": "Scene title",
      "purpose": "Why this scene exists in the narrative",
      "emotionalBeat": "The primary emotion or emotional shift",
      "setting": "Detailed description of the location and time"
    }
  ]
}`,
      model: 'gemma3:1b',
    },
  },
  {
    key: 'generate_shot_plan',
    runtimeType: 'llm_text',
    category: 'planning',
    title: 'Generate Shot Plan',
    description: 'Turns scenes into a structured shot list or storyboard-friendly plan.',
    defaultLabel: 'Generate Shot Plan',
    inputSummary: 'scene_outline',
    outputSummary: 'shot_plan',
    defaultParams: {
      prompt: `You are creating a shot plan for a story based on the provided SOURCE CONTENT (story, canon, and optionally a scene outline).

Rules:
- If SOURCE CONTENT contains a JSON object with a top-level key "scenes" (an array of scenes), then generate shots PER SCENE.
  - For each scene, generate 4–10 shots that match that scene's title/purpose/emotionalBeat/setting.
  - Keep shot numbering restart per scene (1..N) OR use global numbering, but be consistent.
- If no scenes are provided, generate 12–30 shots that cover the story progression using story+canon context.
- Keep descriptions concrete and filmable. Avoid vague repetition.
- Output ONLY valid JSON (no markdown, no explanation, no text before or after).

The JSON MUST conform to one of these schemas:

Schema A (preferred when scenes exist):
{
  "scenes": [
    {
      "title": "Scene title",
      "shots": [
        {
          "shotNumber": "1",
          "description": "Brief description of the shot",
          "framing": "e.g., Wide, Medium, Close-up",
          "angle": "e.g., Eye-level, High, Low",
          "motion": "e.g., Pan, Tilt, Dolly, Static",
          "continuityNotes": "Notes for seamless transitions"
        }
      ]
    }
  ]
}

Schema B (when scenes are not available):
{
  "shots": [
    {
      "shotNumber": "1",
      "description": "Brief description of the shot",
      "framing": "e.g., Wide, Medium, Close-up",
      "angle": "e.g., Eye-level, High, Low",
      "motion": "e.g., Pan, Tilt, Dolly, Static",
      "continuityNotes": "Notes for seamless transitions"
    }
  ]
}`,
      model: 'gemma3:1b',
    },
  },
  {
    key: 'generate_image',
    runtimeType: 'image_generation',
    category: 'generation',
    title: 'Generate Image',
    description: 'Creates still imagery or storyboard frames from planning outputs.',
    defaultLabel: 'Generate Image',
    inputSummary: 'prompt_text or shot_plan',
    outputSummary: 'image_asset',
    defaultParams: {
      prompt: `Generate a cinematic storyboard frame for the selected shot. Output ONLY valid JSON (no markdown, no explanation, no text before or after). The JSON should conform to the following schema:
{
  "image_description": "A detailed description of the image to be generated, including style, subject, and composition."
}`,
      width: 1024,
      height: 1024,
    },
  },
  {
    key: 'generate_video_clip',
    runtimeType: 'video_generation',
    category: 'generation',
    title: 'Generate Video Clip',
    description: 'Creates a video clip from prompt, scene, or storyboard guidance.',
    defaultLabel: 'Generate Video Clip',
    inputSummary: 'prompt_text, shot_plan, or image reference',
    outputSummary: 'video_clip_asset',
    defaultParams: {
      prompt: `Generate a short cinematic clip that matches the selected shot and style. Output ONLY valid JSON (no markdown, no explanation, no text before or after). The JSON should conform to the following schema:
{
  "video_description": "A detailed description of the video clip to be generated, including scene, action, characters, and style."
}`,
      width: 1024,
      height: 576,
    },
  },
  {
    key: 'generate_narration',
    runtimeType: 'tts',
    category: 'generation',
    title: 'Generate Narration',
    description: 'Produces a voice track or narration from prepared text.',
    defaultLabel: 'Generate Narration',
    inputSummary: 'narration_text',
    outputSummary: 'voice_asset',
    defaultParams: {
      text: `Generate narration text based on the provided input. Output ONLY valid JSON (no markdown, no explanation, no text before or after). The JSON should conform to the following schema:
{
  "narration": "The generated narration text."
}`,
      template: 'alloy',
      speed: 1,
      volume: 1,
    },
  },
  {
    key: 'validate_continuity',
    runtimeType: 'llm_text',
    category: 'validation',
    title: 'Validate Continuity',
    description: 'Checks a scene or shot plan for continuity gaps and style drift.',
    defaultLabel: 'Validate Continuity',
    inputSummary: 'scene_outline or shot_plan',
    outputSummary: 'validation_report',
    defaultParams: {
      prompt:
        'Review the current plan for continuity issues, duplicate beats, missing transitions, or style inconsistency.',
      model: 'gemma3:1b',
    },
  },
  {
    key: 'assemble_timeline',
    runtimeType: 'output',
    category: 'assembly',
    title: 'Assemble Timeline',
    description: 'Combines clips, audio, and captions into a structured output timeline.',
    defaultLabel: 'Assemble Timeline',
    inputSummary: 'video_clip_asset + voice_asset',
    outputSummary: 'timeline_asset',
    defaultParams: {},
  },
  {
    key: 'render_preview',
    runtimeType: 'output',
    category: 'export',
    title: 'Render Preview',
    description: 'Produces a preview-ready output artifact from the assembled timeline.',
    defaultLabel: 'Render Preview',
    inputSummary: 'timeline_asset',
    outputSummary: 'preview_asset',
    defaultParams: {},
  },
  {
    key: 'render_final',
    runtimeType: 'output',
    category: 'export',
    title: 'Render Final',
    description: 'Produces a final delivery artifact for export.',
    defaultLabel: 'Render Final',
    inputSummary: 'timeline_asset',
    outputSummary: 'final_asset',
    defaultParams: {},
  },
  {
    key: 'asset_review',
    runtimeType: 'asset_review',
    category: 'planning',
    title: 'Review & Edit',
    description:
      'Displays a text asset for review and allows manual modifications before the next step.',
    defaultLabel: 'Review Asset',
    inputSummary: 'any text output',
    outputSummary: 'edited_text',
    defaultParams: {
      edited_text: '',
    },
  },
];

export const workflowTemplateCatalog: WorkflowTemplateDefinition[] = [
  {
    id: 'storyboard_from_story',
    title: 'Storyboard From Story',
    description: 'Turns typed story input into canon, scenes, a shot plan, and storyboard frames.',
    templateType: 'film',
    mode: 'advanced',
    defaults: {
      tone: 'cinematic',
      audience: 'general',
      output_style: 'storyboard',
    },
    metadata: {
      editor_template: 'storyboard_from_story',
    },
    nodes: [
      { id: 'story-input', nodeKey: 'story_input' },
      { id: 'extract-canon', nodeKey: 'extract_canon' },
      { id: 'generate-scenes', nodeKey: 'generate_scenes' },
      { id: 'generate-shot-plan', nodeKey: 'generate_shot_plan' },
      { id: 'generate-image', nodeKey: 'generate_image' },
      { id: 'render-preview', nodeKey: 'render_preview' },
    ],
    edges: [
      { id: 'edge-1', source: 'story-input', target: 'extract-canon' },
      { id: 'edge-2', source: 'extract-canon', target: 'generate-scenes' },
      { id: 'edge-3', source: 'generate-scenes', target: 'generate-shot-plan' },
      { id: 'edge-4', source: 'generate-shot-plan', target: 'generate-image' },
      { id: 'edge-5', source: 'generate-image', target: 'render-preview' },
    ],
  },
  {
    id: 'short_video_from_prompt',
    title: 'Short Video From Prompt',
    description:
      'Starts from a typed prompt, generates a shot plan and clip, then prepares a preview.',
    templateType: 'short_form_video',
    mode: 'advanced',
    defaults: {
      duration_target_seconds: 15,
      aspect_ratio: '16:9',
    },
    metadata: {
      editor_template: 'short_video_from_prompt',
    },
    nodes: [
      { id: 'prompt-input', nodeKey: 'prompt_input' },
      { id: 'generate-shot-plan', nodeKey: 'generate_shot_plan' },
      { id: 'generate-video', nodeKey: 'generate_video_clip' },
      { id: 'assemble-timeline', nodeKey: 'assemble_timeline' },
      { id: 'render-preview', nodeKey: 'render_preview' },
    ],
    edges: [
      { id: 'edge-1', source: 'prompt-input', target: 'generate-shot-plan' },
      { id: 'edge-2', source: 'generate-shot-plan', target: 'generate-video' },
      { id: 'edge-3', source: 'generate-video', target: 'assemble-timeline' },
      { id: 'edge-4', source: 'assemble-timeline', target: 'render-preview' },
    ],
  },
  {
    id: 'narrated_story_video',
    title: 'Narrated Story Video',
    description: 'Builds a narrated video flow with scenes, stills, voice, and a preview timeline.',
    templateType: 'audio_story',
    mode: 'advanced',
    defaults: {
      narration_style: 'warm',
      aspect_ratio: '16:9',
    },
    metadata: {
      editor_template: 'narrated_story_video',
    },
    nodes: [
      { id: 'story-input', nodeKey: 'story_input' },
      { id: 'generate-scenes', nodeKey: 'generate_scenes' },
      { id: 'generate-image', nodeKey: 'generate_image' },
      {
        id: 'generate-narration',
        nodeKey: 'generate_narration',
        params: {
          text: `Generate narration text based on the provided input. Output ONLY valid JSON (no markdown, no explanation, no text before or after). The JSON should conform to the following schema:
{
  "narration": "The generated narration text."
}`,
          template: 'alloy',
          speed: 1,
          volume: 1,
        },
      },
      { id: 'assemble-timeline', nodeKey: 'assemble_timeline' },
      { id: 'render-preview', nodeKey: 'render_preview' },
    ],
    edges: [
      { id: 'edge-1', source: 'story-input', target: 'generate-scenes' },
      { id: 'edge-2', source: 'generate-scenes', target: 'generate-image' },
      { id: 'edge-3', source: 'generate-scenes', target: 'generate-narration' },
      { id: 'edge-4', source: 'generate-image', target: 'assemble-timeline' },
      { id: 'edge-5', source: 'generate-narration', target: 'assemble-timeline' },
      { id: 'edge-6', source: 'assemble-timeline', target: 'render-preview' },
    ],
  },
];

export function getWorkflowNodeDefinition(nodeKey: string) {
  return workflowNodeCatalog.find(node => node.key === nodeKey) ?? null;
}

export function getWorkflowTemplateDefinition(templateId: string) {
  return workflowTemplateCatalog.find(template => template.id === templateId) ?? null;
}

export function createWorkflowNodeFromCatalog(
  nodeKey: string,
  overrides?: {
    id?: string;
    label?: string;
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }
) {
  const definition = getWorkflowNodeDefinition(nodeKey);

  if (!definition) {
    throw new Error(`Unknown workflow node key: ${nodeKey}`);
  }

  return {
    id: overrides?.id ?? `${nodeKey}-${Math.random().toString(36).slice(2, 7)}`,
    type: nodeKey,
    params: {
      ...definition.defaultParams,
      ...(overrides?.params ?? {}),
    },
    data: {
      label: overrides?.label ?? definition.defaultLabel,
      catalog_type: definition.key,
      category: definition.category,
      ...(definition.defaultData ?? {}),
      ...(overrides?.data ?? {}),
    },
  };
}

export function createWorkflowDraftFromTemplate(templateId: string) {
  const template = getWorkflowTemplateDefinition(templateId);

  if (!template) {
    throw new Error(`Unknown workflow template: ${templateId}`);
  }

  return {
    title: template.title,
    description: template.description,
    mode: template.mode,
    template_type: template.templateType,
    defaults: template.defaults,
    metadata: template.metadata,
    nodes: template.nodes.map(node =>
      createWorkflowNodeFromCatalog(node.nodeKey, {
        id: node.id,
        label: node.label,
        params: node.params,
        data: node.data,
      })
    ),
    edges: template.edges.map(edge => ({ ...edge })),
  };
}
