export type ShotPlanItem = {
  id?: string;
  shot?: string | number; // New standard
  shotNumber?: string | number; // Legacy
  action?: string; // New standard
  description?: string; // Legacy
  narration?: string;
  internal_monologue?: string;
  dialogue?: string;
  characters?: string[];
  environment?: string;
  props?: string[];
  framing?: string;
  angle?: string;
  motion?: string;
  continuityNotes?: string;
  frame_prompt?: string;
  video_prompt?: string;
  image?: {
    prompt_structured?: string;
    prompt?: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    last_updated_by?: string;
    last_updated_at?: string;
  };
};

type ShotPlanScene = {
  scene?: number;
  title?: string;
  description?: string;
  purpose?: string;
  emotionalBeat?: string;
  setting?: string;
  shot_count?: number;
  shots?: ShotPlanItem[];
};

export type ParsedShotPlanForEdit =
  | { mode: 'direct'; wrapper: Record<string, unknown>; plan: Record<string, unknown> }
  | { mode: 'wrapped'; wrapper: Record<string, unknown>; wrapperKey: '_raw' | 'text'; plan: Record<string, unknown> };

function hasDirectPlan(obj: unknown) {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  return Array.isArray(record.scenes) || Array.isArray(record.shots);
}

export function parseShotPlanForEdit(content: Record<string, unknown>): ParsedShotPlanForEdit | null {
  const raw = (content ?? {}) as Record<string, unknown>;
  if (hasDirectPlan(raw)) return { mode: 'direct', wrapper: raw, plan: raw };

  const wrapperKey: '_raw' | 'text' | undefined =
    typeof raw._raw === 'string' ? '_raw' : typeof raw.text === 'string' ? 'text' : undefined;
  if (!wrapperKey) return null;
  const rawText = raw[wrapperKey];
  if (typeof rawText !== 'string' || !rawText) return null;

  try {
    const parsed = JSON.parse(rawText) as unknown;
    if (!hasDirectPlan(parsed)) return null;
    return { mode: 'wrapped', wrapper: raw, wrapperKey, plan: parsed as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function writeBackShotPlan(parsed: ParsedShotPlanForEdit, nextPlan: Record<string, unknown>) {
  if (parsed.mode === 'direct') {
    return {
      ...(parsed.wrapper ?? {}),
      ...(nextPlan ?? {}),
    } as Record<string, unknown>;
  }
  return {
    ...(parsed.wrapper ?? {}),
    [parsed.wrapperKey]: JSON.stringify(nextPlan ?? {}, null, 2),
  } as Record<string, unknown>;
}

export function ensureShotIdsInPlan(plan: Record<string, unknown>, planId: string) {
  let flatIndex = 0;

  const ensureShotId = (shot: ShotPlanItem) => {
    if (!shot || typeof shot !== 'object') return;
    if (typeof shot.id === 'string' && shot.id.trim()) return;
    shot.id = `${planId}:${flatIndex}`;
  };

  const scenesRaw = plan.scenes;
  if (Array.isArray(scenesRaw)) {
    for (const scene of scenesRaw) {
      if (!scene || typeof scene !== 'object') continue;
      const shots = (scene as Record<string, unknown>).shots;
      if (!Array.isArray(shots)) continue;
      for (const shot of shots) {
        if (!shot || typeof shot !== 'object') continue;
        ensureShotId(shot as ShotPlanItem);
        flatIndex += 1;
      }
    }
    return;
  }

  const shotsRaw = plan.shots;
  if (Array.isArray(shotsRaw)) {
    for (const shot of shotsRaw) {
      if (!shot || typeof shot !== 'object') continue;
      ensureShotId(shot as ShotPlanItem);
      flatIndex += 1;
    }
  }
}

export type LocatedShot = {
  shot: ShotPlanItem;
  shotPath: string;
  sceneTitle?: string;
};

export function locateShotInPlan(plan: Record<string, unknown>, shotId: string): LocatedShot | null {
  const scenesRaw = plan.scenes;
  if (Array.isArray(scenesRaw)) {
    const scenes = scenesRaw.filter(s => s && typeof s === 'object') as ShotPlanScene[];
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
      const scene = scenes[sceneIndex];
      const shotsRaw = Array.isArray(scene.shots)
        ? (scene.shots.filter(s => s && typeof s === 'object') as ShotPlanItem[])
        : [];
      for (let shotIndex = 0; shotIndex < shotsRaw.length; shotIndex += 1) {
        const shot = shotsRaw[shotIndex];
        if (typeof shot.id === 'string' && shot.id === shotId) {
          return {
            shot,
            shotPath: `/scenes/${sceneIndex}/shots/${shotIndex}`,
            sceneTitle: typeof scene.title === 'string' ? scene.title : undefined,
          };
        }
      }
    }
    return null;
  }

  const shotsRaw = plan.shots;
  if (Array.isArray(shotsRaw)) {
    const shots = shotsRaw.filter(s => s && typeof s === 'object') as ShotPlanItem[];
    for (let i = 0; i < shots.length; i += 1) {
      const shot = shots[i];
      if (typeof shot.id === 'string' && shot.id === shotId) {
        return { shot, shotPath: `/shots/${i}` };
      }
    }
  }
  return null;
}

export function updateShotImageOverrideInPlan(
  plan: Record<string, unknown>,
  located: LocatedShot,
  image: NonNullable<ShotPlanItem['image']>
) {
  const sceneMatch = located.shotPath.match(/^\/scenes\/(\d+)\/shots\/(\d+)$/);
  if (sceneMatch) {
    const sceneIndex = Number(sceneMatch[1]);
    const shotIndex = Number(sceneMatch[2]);
    const scenes = (plan.scenes as unknown[]) as Record<string, unknown>[];
    const scene = scenes[sceneIndex] ?? {};
    const shots = (scene as any).shots as ShotPlanItem[];
    const target = shots?.[shotIndex] ?? {};
    shots[shotIndex] = { ...(target as ShotPlanItem), image };
    (scene as any).shots = shots;
    scenes[sceneIndex] = scene;
    plan.scenes = scenes;
    return;
  }

  const shotMatch = located.shotPath.match(/^\/shots\/(\d+)$/);
  if (shotMatch) {
    const shotIndex = Number(shotMatch[1]);
    const shots = (plan.shots as unknown[]) as ShotPlanItem[];
    const target = shots?.[shotIndex] ?? {};
    shots[shotIndex] = { ...(target as ShotPlanItem), image };
    plan.shots = shots;
  }
}

