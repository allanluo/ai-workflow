# Service Adapter and Node Implementation Contract v1

## 1. Purpose
Define how workflow nodes interact with execution services such as LLM, image generation, video generation, TTS, music, validation, and rendering.

This contract is the boundary between the workflow engine and actual model-backed services.

---

## 2. Design Goals
The adapter layer must:
- isolate the workflow engine from backend-specific APIs
- support local and remote services through the same interface
- normalize inputs and outputs across providers
- preserve reproducibility metadata
- support retries, timeouts, and error classification
- make service swapping possible without changing workflow logic

---

## 3. Core Principle
Workflow nodes should call **capabilities**, not specific vendors.

Examples:
- `text_generate`
- `image_generate`
- `video_generate`
- `speech_generate`
- `timeline_render`
- `continuity_validate`

The workflow engine targets capability contracts.
Adapters translate those contracts into provider-specific requests.

---

## 4. Layer Model

### 4.1 Workflow Engine Layer
Understands:
- workflow versions
- node types
- node configs
- asset references
- execution rules

Does not understand:
- Ollama payload details
- ComfyUI graph JSON details
- ffmpeg command syntax

### 4.2 Service Adapter Layer
Understands:
- capability contracts
- provider selection
- request transformation
- response normalization
- error mapping
- reproducibility metadata capture

### 4.3 Provider Client Layer
Understands:
- actual HTTP/local API calls
- provider-specific schema
- transport and auth
- polling or streaming if required

---

## 5. Capability Types for v1
Recommended capability registry:
- `text_generate`
- `text_transform`
- `image_generate`
- `video_generate`
- `speech_generate`
- `music_attach`
- `caption_generate`
- `timeline_render`
- `validation_run`
- `asset_transform`

These are capability-level contracts, not UI concepts.

---

## 6. Generic Service Request Envelope
All node-to-adapter calls should normalize into a shared request envelope.

```json
{
  "request_id": "req_001",
  "project_id": "proj_001",
  "workflow_version_id": "wf_ver_012",
  "workflow_run_id": "wf_run_204",
  "node_id": "node_generate_shots",
  "node_run_id": "node_run_01",
  "capability": "text_generate",
  "execution_mode": "deterministic",
  "inputs": {},
  "config": {},
  "constraints": {},
  "model_binding": {},
  "runtime": {
    "timeout_sec": 180,
    "retry_policy": "fail_fast",
    "seed_mode": "fixed",
    "seed": 128493
  },
  "metadata": {}
}
```

This envelope is provider-agnostic.

---

## 7. Generic Service Response Envelope
Adapters should return a normalized response.

```json
{
  "request_id": "req_001",
  "status": "completed",
  "capability": "text_generate",
  "provider": {
    "name": "ollama",
    "adapter": "ollama_text_adapter",
    "model": "qwen3:8b",
    "model_version": "qwen3:8b@local"
  },
  "artifacts": [],
  "metrics": {
    "duration_ms": 2450
  },
  "warnings": [],
  "errors": [],
  "raw_response_ref": null,
  "reproducibility": {
    "seed": 128493,
    "temperature": 0.2,
    "top_p": 0.9
  }
}
```

The workflow engine should never need direct provider response parsing beyond this normalized schema.

---

## 8. Artifact Model
Service responses should return typed artifacts.

Supported artifact types in v1:
- `text`
- `image`
- `video`
- `audio`
- `captions`
- `timeline`
- `validation_result`
- `structured_json`

Example artifact:

```json
{
  "artifact_type": "text",
  "role": "shot_plan",
  "content": "...",
  "format": "markdown"
}
```

Example media artifact:

```json
{
  "artifact_type": "image",
  "role": "preview_frame",
  "file_ref": "/projects/proj_001/assets/images/img_225.png",
  "metadata": {
    "width": 1280,
    "height": 720
  }
}
```

---

## 9. Node Implementation Contract
Each node type should declare:
- required capability
- expected inputs
- expected outputs
- config schema
- adapter selection rules
- asset creation rules

Suggested conceptual shape:

```json
{
  "node_type": "generate_shot_plan",
  "capability": "text_generate",
  "input_schema": {},
  "config_schema": {},
  "output_schema": {},
  "asset_mapping": {}
}
```

This contract lets the workflow engine validate node definitions before execution.

---

## 10. Input Resolution Rules
Before an adapter call, the engine must resolve node inputs into concrete values.

Possible resolved input types:
- literal strings
- structured JSON
- asset content snapshots
- file references
- versioned asset refs
- upstream node artifacts

The adapter should receive resolved inputs, not open-ended queries.

---

## 11. Model Binding Contract
Nodes may specify model bindings directly, or inherit defaults.

Suggested shape:

```json
{
  "provider": "ollama",
  "adapter": "ollama_text_adapter",
  "model": "qwen3:8b",
  "model_version": "qwen3:8b@local",
  "temperature": 0.2,
  "top_p": 0.9,
  "max_tokens": 3000
}
```

For image/video services:

```json
{
  "provider": "comfyui_local",
  "adapter": "comfyui_image_adapter",
  "model": "flux_dev",
  "model_version": "flux_dev_checkpoint_hash_abc",
  "sampler": "euler",
  "steps": 28,
  "cfg_scale": 6.5
}
```

All effective bindings should be recorded in the node run.

---

## 12. Service Selection Strategy
Service selection should happen through explicit rules.

Selection sources:
- node-level binding
- workflow default binding
- project-level environment defaults
- system fallback policy

Priority order:
1. node-level binding
2. workflow default
3. project default
4. system default

Fallback use should always be recorded.

---

## 13. Error Classification
Adapters should normalize provider errors into a common taxonomy.

Recommended error classes:
- `timeout`
- `unavailable`
- `bad_request`
- `validation_error`
- `provider_error`
- `generation_failed`
- `output_parse_failed`
- `storage_failed`
- `canceled`

Example normalized error:

```json
{
  "code": "timeout",
  "message": "Image generation timed out after 180 seconds.",
  "provider_message": "request timeout",
  "retryable": true
}
```

---

## 14. Reproducibility Metadata Contract
Every adapter response should capture reproducibility-relevant metadata when available.

Examples:
- model version
- seed
- temperature
- top_p
- sampler
- steps
- cfg scale
- prompt hash
- negative prompt hash
- service version
- backend graph hash if applicable

This data should be persisted in node runs and media asset metadata.

---

## 15. Provider-Agnostic Prompt Strategy
Prompt construction should not be embedded deep in each provider client.

Instead, separate:
- **prompt builder** logic
- **adapter transport** logic

Prompt builders should:
- combine asset content
- apply templates
- apply constraints
- return normalized prompt payloads

Adapters should:
- submit payloads to providers
- collect responses
- normalize outputs

This avoids mixing creative logic with transport logic.

---

## 16. Text Generation Contract
Used for:
- extract canon
- generate scenes
- generate shot plans
- generate narration
- generate captions draft
- revise prompts

### Request shape example
```json
{
  "capability": "text_generate",
  "inputs": {
    "instruction": "Generate a shot plan from approved scenes.",
    "scene_assets": [...],
    "character_bible": {...}
  },
  "config": {
    "output_format": "structured_json",
    "schema_name": "shot_plan_v1"
  },
  "constraints": {
    "preserve_fields": ["character_identity", "environment", "wardrobe"]
  },
  "model_binding": {
    "provider": "ollama",
    "adapter": "ollama_text_adapter",
    "model": "qwen3:8b"
  }
}
```

### Response artifact example
```json
{
  "artifact_type": "structured_json",
  "role": "shot_plan",
  "content": {
    "shots": []
  },
  "schema_name": "shot_plan_v1"
}
```

---

## 17. Image Generation Contract
Used for:
- storyboard frame generation
- shot image generation
- preview still generation

### Request shape example
```json
{
  "capability": "image_generate",
  "inputs": {
    "prompt": "Close-up of Allan lying in dry grass, touching the AK-47 magazine.",
    "negative_prompt": "extra hands, duplicated weapon, face drift",
    "reference_images": [
      "/projects/proj_001/refs/allan_face.png"
    ]
  },
  "config": {
    "width": 1280,
    "height": 720,
    "count": 1
  },
  "constraints": {
    "preserve_character_identity": true,
    "preserve_environment": true
  },
  "model_binding": {
    "provider": "comfyui_local",
    "adapter": "comfyui_image_adapter",
    "model": "flux_dev"
  },
  "runtime": {
    "seed_mode": "fixed",
    "seed": 45123
  }
}
```

### Response artifact example
```json
{
  "artifact_type": "image",
  "role": "shot_preview",
  "file_ref": "/projects/proj_001/assets/images/img_225.png",
  "metadata": {
    "width": 1280,
    "height": 720,
    "seed": 45123
  }
}
```

---

## 18. Video Generation Contract
Used for:
- shot clip generation
- image-to-video motion generation
- video variation generation

### Request shape example
```json
{
  "capability": "video_generate",
  "inputs": {
    "prompt": "Allan remains low in the dry grass and carefully checks the AK-47 magazine.",
    "reference_image": "/projects/proj_001/assets/images/img_225.png",
    "duration_sec": 4
  },
  "config": {
    "fps": 24,
    "width": 1280,
    "height": 720
  },
  "constraints": {
    "motion_level": "low",
    "preserve_subject_identity": true
  },
  "model_binding": {
    "provider": "comfyui_local",
    "adapter": "comfyui_video_adapter",
    "model": "ltx_video"
  },
  "runtime": {
    "seed_mode": "fixed",
    "seed": 87221
  }
}
```

---

## 19. Speech Generation Contract
Used for:
- narration
- dialogue lines
- voiceovers

### Request shape example
```json
{
  "capability": "speech_generate",
  "inputs": {
    "text": "How many left...",
    "voice_profile": {
      "voice_id": "allan_voice_01",
      "style": "quiet, tense"
    }
  },
  "config": {
    "format": "wav",
    "sample_rate": 24000
  },
  "model_binding": {
    "provider": "local_tts",
    "adapter": "tts_speech_adapter",
    "model": "piper_en_us"
  }
}
```

---

## 20. Timeline Render Contract
Used for:
- preview assembly
- final export

### Request shape example
```json
{
  "capability": "timeline_render",
  "inputs": {
    "timeline_segments": [...],
    "video_clips": [...],
    "audio_tracks": [...],
    "caption_track": null
  },
  "config": {
    "target_format": "mp4",
    "resolution": "1280x720",
    "fps": 24
  },
  "model_binding": {
    "provider": "local_renderer",
    "adapter": "ffmpeg_render_adapter",
    "model": "ffmpeg"
  }
}
```

---

## 21. Validation Contract
Validation nodes should use a dedicated validation capability.

### Request shape example
```json
{
  "capability": "validation_run",
  "inputs": {
    "target_asset": "shot_012:v4",
    "reference_assets": ["char_allan:v7", "env_savanna:v3"]
  },
  "config": {
    "rules": ["preserve_face_identity", "wardrobe_match", "environment_match"]
  }
}
```

### Response artifact example
```json
{
  "artifact_type": "validation_result",
  "role": "continuity_validation",
  "content": {
    "status": "warn",
    "rule_results": []
  }
}
```

---

## 22. Asset Mapping Rules
Each node type must define how artifacts become assets.

Examples:
- `structured_json` shot plan -> create `shot` assets
- `image` artifact -> create `image_output` asset
- `video` artifact -> create `video_clip` asset
- `audio` artifact -> create `voice_take` asset
- `validation_result` artifact -> create `validation_result` asset

Asset mapping should be deterministic and explicit.

---

## 23. Adapter Registry
Recommended registry structure:

```json
{
  "text_generate": ["ollama_text_adapter", "openai_text_adapter"],
  "image_generate": ["comfyui_image_adapter"],
  "video_generate": ["comfyui_video_adapter"],
  "speech_generate": ["tts_speech_adapter"],
  "timeline_render": ["ffmpeg_render_adapter"],
  "validation_run": ["continuity_validator_adapter"]
}
```

The engine chooses an adapter based on model binding and availability.

---

## 24. Suggested Adapter Interface
Conceptually, each adapter should support:
- `validate_request(request)`
- `execute(request)`
- `normalize_response(raw_response)`
- `classify_error(raw_error)`

Optional:
- `cancel(request_id)`
- `health_check()`
- `estimate_cost_or_time(request)`

---

## 25. Local Stack Mapping Example
For your likely local stack, this might map as:

- Ollama -> `ollama_text_adapter`
- ComfyUI image workflows -> `comfyui_image_adapter`
- ComfyUI video workflows -> `comfyui_video_adapter`
- Piper/Fish/CosyVoice -> `tts_speech_adapter`
- ffmpeg -> `ffmpeg_render_adapter`

This lets your workflow engine stay stable while the local providers evolve.

---

## 26. Security and Isolation Notes
The adapter layer should:
- validate file paths before provider submission
- isolate provider-specific temp files
- avoid arbitrary command injection in render steps
- limit provider requests to known capability schemas

Especially important for local rendering and shell-based tools.

---

## 27. Observability Requirements
Each adapter call should record:
- request id
- node id
- provider
- adapter
- duration
- status
- error classification
- artifact count
- reproducibility metadata

This supports debugging and trust.

---

## 28. Open Design Questions
1. Should prompt builders be separate reusable modules or embedded in node implementations?
2. Should adapters support streaming partial outputs in v1 or later?
3. How should ComfyUI workflow JSON be versioned and referenced?
4. Should text-generation nodes require structured JSON output whenever possible?
5. How should validator adapters access image/video comparison logic?
6. What is the minimum health-check interface for provider clients?
7. How should local file refs be abstracted if remote execution is added later?
8. Which adapters should support cancellation in v1?

