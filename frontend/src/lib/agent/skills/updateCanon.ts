import type { Asset } from '../../api';
import type { JsonPatchOperation, Skill, SkillContext, SkillResult } from '../types';
import { extractFirstJsonObjectLenient } from '../llmClient';
import { executeTool } from '../tools';

type UserIntentMode = 'discussion' | 'direction' | 'correction' | 'application';

type CanonPatchResponse = {
  patch?: JsonPatchOperation[];
  questions?: { id: string; question: string; default?: string }[];
  assumptions?: string[];
};

type CanonCharacter = {
  name?: unknown;
  role?: unknown;
  description?: unknown;
  appearance?: unknown;
  [k: string]: unknown;
};

type CanonCharacterAppearance = {
  face?: string;
  hair?: string;
  clothing?: string;
  shoes?: string;
  hat?: string;
  accessories?: string;
};

const APPEARANCE_KEYS: Array<keyof CanonCharacterAppearance> = ['face', 'hair', 'clothing', 'shoes', 'hat', 'accessories'];

// Intent Mode Detection
function detectUserIntentMode(input: string): UserIntentMode {
  const lower = (input || '').toLowerCase().trim();
  
  // Application mode: user is ready to execute
  if (/^\/apply\b|^\/review\b|^\/run\b|^yes\b|^yes,|^proceed\b|^confirm\b/i.test(lower)) {
    return 'application';
  }
  
  // Correction mode: user is rejecting and providing new direction
  // Detects: "no", "wrong", "redo", "incorrect", or explicit "is not right", "is wrong"
  if (/^no(?:\s|,|$)|^that'?s wrong|^please redo|^incorrect|^not what|^i don't like|is not right|is wrong/i.test(lower)) {
    return 'correction';
  }
  
  // Direction mode: user provides explicit field values (face:, hair:, etc.)
  // This triggers even without directive keywords—structured data IS the directive
  const hasStructuredData = /\b(face|hair|clothing|shoes|description|appearance|role|name)\s*:/i.test(input);
  
  if (hasStructuredData) {
    // If user provides field values, treat as direction mode
    // (they may or may not have directive keywords like "use", "fix", etc.)
    return 'direction';
  }
  
  // Discussion mode: exploratory/conversational (no structured field values)
  return 'discussion';
}

// Extract individual field from text
function extractField(text: string, fieldName: string): string {
  // First try to match quoted values (handles "value" or 'value')
  const quotedRe = new RegExp(`\\b${fieldName}\\s*:\\s*["']([^"']+)["']`, 'i');
  let m = text.match(quotedRe);
  if (m?.[1]) {
    return clamp(normalizeWhitespace(m[1].trim()), 180);
  }

  // Fall back to comma-separated logic (original behavior)
  const re = new RegExp(`\\b${fieldName}\\s*:\\s*([^,\\n]+?)(?=\\s*,\\s*\\b(?:face|hair|clothing|shoes|hat|accessories|body|details|name|role|appearance)\\s*:|\\s*,\\s*$|\\n|$)`, 'i');
  m = text.match(re);
  const value = m?.[1] ? normalizeWhitespace(m[1].trim()) : '';
  // Clean trailing comma if present
  const cleaned = value.replace(/,\s*$/, '').trim();
  return cleaned ? clamp(cleaned, 180) : '';
}

// Extract all direction data from user input
function extractDirectionData(input: string): Partial<CanonCharacterAppearance> | null {
  const out: Partial<CanonCharacterAppearance> = {};
  
  for (const key of APPEARANCE_KEYS) {
    const v = extractField(input, key);
    if (isMeaningfulFieldValue(v)) {
      out[key] = v;
    }
  }
  
  return Object.keys(out).length > 0 ? out : null;
}

function detectRequestedAppearanceKeys(text: string): Array<keyof CanonCharacterAppearance> {
  const t = stripMarkdownLike(text || '').toLowerCase();
  if (!t) return [];
  const keys: Array<keyof CanonCharacterAppearance> = [];
  for (const k of APPEARANCE_KEYS) {
    const re = new RegExp(`\\b${k}\\b`, 'i');
    if (re.test(t)) keys.push(k);
  }
  // If the user says "appearance" but no specific keys, don’t over-assume.
  return [...new Set(keys)];
}

function extractAppearanceKeyValues(text: string) {
  const t = stripMarkdownLike(text || '');
  const out: Partial<Record<keyof CanonCharacterAppearance, string>> = {};
  for (const k of APPEARANCE_KEYS) {
    // Use the improved extractField function which handles quoted values
    const v = extractField(t, k);
    if (isMeaningfulFieldValue(v)) {
      out[k] = v;
    }
  }
  return out;
}

function buildAppearanceFallbackLines(input: {
  requestedKeys: Array<keyof CanonCharacterAppearance>;
  allan: any;
  discussionText?: string;
}) {
  const requested = input.requestedKeys ?? [];
  const allan = input.allan ?? null;
  const descFromCanon = typeof allan?.description === 'string' ? stripMarkdownLike(allan.description) : '';
  const descFromDiscussion = input.discussionText ? extractAllanDescription(input.discussionText) : '';
  const desc = descFromDiscussion || descFromCanon;
  const existing = allan?.appearance && typeof allan.appearance === 'object' && !Array.isArray(allan.appearance) ? allan.appearance : {};

  const getExisting = (k: keyof CanonCharacterAppearance) => {
    const v = typeof existing?.[k] === 'string' ? String(existing[k]).trim() : '';
    return isMeaningfulFieldValue(v) ? clamp(v, 180) : '';
  };

  const has = (re: RegExp) => re.test(desc.toLowerCase());

  const suggestFace = () => {
    const bits: string[] = [];
    if (has(/\bdark circles?\b/)) bits.push('tired eyes with faint dark circles');
    if (has(/\bscar\b/) || has(/\beyebrow\b/)) bits.push('faint scar above the left eyebrow');
    if (has(/\bfrec(k)?le(s)?\b/)) bits.push('a few faint freckles on the left cheek');
    if (!bits.length) bits.push('young adult face, slightly pale, anxious/thoughtful expression');
    return clamp(bits.join('; '), 220);
  };

  const suggestHair = () => {
    if (has(/\breceding\b/) || has(/\bhairline\b/)) return 'short dark-brown hair with a slight recession at the temples';
    return 'short dark-brown hair, slightly messy from running through tall grass';
  };

  const suggestClothing = () => {
    const m = desc.match(/\b(wearing|wears)\b([^.!?]{10,140})/i);
    if (m?.[2]) return clamp(`wearing${normalizeWhitespace(m[2])}`, 180);
    return 'dark blue faded hoodie over jeans (student casual)';
  };

  const suggestShoes = () => 'worn sneakers suitable for running on uneven ground';
  const suggestHat = () => 'no hat';
  const suggestAccessories = () => {
    if (has(/\bsatchel\b/) || has(/\bnotebook\b/) || has(/\bbooks?\b/)) return 'worn leather satchel with a notebook';
    return 'simple canvas backpack';
  };

  const suggestFor = (k: keyof CanonCharacterAppearance) => {
    const existing = getExisting(k);
    if (existing) return existing;
    switch (k) {
      case 'face': return suggestFace();
      case 'hair': return clamp(suggestHair(), 180);
      case 'clothing': return clamp(suggestClothing(), 180);
      case 'shoes': return clamp(suggestShoes(), 180);
      case 'hat': return clamp(suggestHat(), 180);
      case 'accessories': return clamp(suggestAccessories(), 180);
      default: return '';
    }
  };

  const lines = requested
    .map(k => {
      const v = suggestFor(k);
      return isMeaningfulFieldValue(v) ? `${k}: ${v}` : '';
    })
    .filter(Boolean);
  return lines.join('\n');
}

function normalizeWhitespace(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function stripMarkdownLike(text: string) {
  let t = String(text || '');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/[*_`]+/g, '');
  t = t.replace(/^\s*[-*]\s+/gm, '');
  t = t.replace(/^\s*\d+\.\s+/gm, '');
  t = t.replace(/^\s*#+\s*/gm, '');
  return normalizeWhitespace(t);
}

function stripChattyPreamble(text: string) {
  let t = String(text || '').trim();
  t = t.replace(/^(okay|alright|sure|great|i understand)\b[.:!,-]?\s*/i, '');
  t = t.replace(/^let['’]s\b[^.?!]*[.?!]\s*/i, '');
  return t.trim();
}

function clamp(text: string, max: number) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, '').trim();
}

function isMeaningfulFieldValue(value: string) {
  const v = (value || '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  // Reject exact matches and variants of "unspecified"/"unknown"
  if (lower === 'unspecified' || lower === 'unknown' || /^unspecified\b|^unknown\b/i.test(v.trim())) return false;
  // Also reject if it's ONLY describing the problem without providing real value
  // (e.g., "Unspecified is not right", "only Unspecified")
  if (/\bunspecified\b.*only\b|only.*\bunspecified\b/i.test(v)) return false;
  return true;
}

function extractBetween(text: string, startRe: RegExp, endRes: RegExp[]) {
  const m = text.match(startRe);
  if (!m || m.index == null) return '';
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  let end = rest.length;
  for (const re of endRes) {
    const em = rest.match(re);
    if (em && em.index != null) end = Math.min(end, em.index);
  }
  return rest.slice(0, end).trim();
}

function extractAllanDescription(text: string) {
  const raw = stripMarkdownLike(text);
  if (!raw) return '';

  const descBlock = extractBetween(raw, /\bdescription:\s*/i, [
    /\bappearance:\s*/i,
    /\bpersonality:\s*/i,
    /\brelationships?:\s*/i,
  ]);
  if (descBlock) {
    return clamp(stripChattyPreamble(descBlock), 420);
  }

  const idx = raw.toLowerCase().indexOf('allan is');
  if (idx >= 0) {
    const tail = raw.slice(idx);
    const stop = extractBetween(tail, /^allan is\s*/i, [/\bappearance:\s*/i, /\bpersonality:\s*/i, /\brelationships?:\s*/i]);
    const candidate = (stop ? `Allan is ${stop}` : tail).trim();
    return clamp(stripChattyPreamble(candidate), 420);
  }

  return clamp(stripChattyPreamble(raw), 420);
}

function isPatchOp(op: unknown): op is JsonPatchOperation {
  if (!op || typeof op !== 'object') return false;
  const r = op as Record<string, unknown>;
  const kind = r.op;
  const path = r.path;
  if (kind !== 'add' && kind !== 'replace' && kind !== 'remove') return false;
  if (typeof path !== 'string' || !path.startsWith('/')) return false;
  if ((kind === 'add' || kind === 'replace') && !('value' in r)) return false;
  return true;
}

function isCanonPatchResponse(value: unknown): value is CanonPatchResponse {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (r.patch !== undefined) {
    if (!Array.isArray(r.patch)) return false;
    if (!(r.patch as unknown[]).every(isPatchOp)) return false;
  }
  if (r.questions !== undefined) {
    if (!Array.isArray(r.questions)) return false;
    const ok = (r.questions as unknown[]).every(q => {
      if (!q || typeof q !== 'object') return false;
      const qr = q as Record<string, unknown>;
      return typeof qr.id === 'string' && typeof qr.question === 'string';
    });
    if (!ok) return false;
  }
  if (r.assumptions !== undefined) {
    if (!Array.isArray(r.assumptions)) return false;
  }
  return true;
}

function pickLatestNonDeprecated(assets: Asset[]) {
  return (
    [...assets]
      .filter(a => a.status !== 'deprecated')
      .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0] ??
    null
  );
}

function canonContent(asset: Asset) {
  return (asset.current_version?.content ?? asset.current_approved_version?.content ?? {}) as Record<string, unknown>;
}

function isAddOrReplace(op: JsonPatchOperation) {
  return op.op === 'add' || op.op === 'replace';
}

function parseCharacterIndexFromPath(path: string) {
  const m = String(path || '').match(/^\/characters\/(\d+)(\/|$)/);
  if (!m) return null;
  const idx = Number(m[1]);
  return Number.isFinite(idx) ? idx : null;
}

function getCharacterName(char: any) {
  const name = typeof char?.name === 'string' ? char.name : '';
  return name.trim();
}

function findCharacterIndexByName(characters: unknown, name: string) {
  if (!Array.isArray(characters)) return null;
  const wanted = (name || '').trim().toLowerCase();
  if (!wanted) return null;
  const idx = characters.findIndex(c => getCharacterName(c).toLowerCase() === wanted);
  return idx >= 0 ? idx : null;
}

function looksLikeUserOnlyMentionsAllan(text: string) {
  const t = (extractDirectiveWindow(text) || '').toLowerCase();
  if (!t.includes('allan')) return false;
  // If other names are explicitly mentioned, don't over-constrain.
  if (/\byiga\b/.test(t)) return false;
  if (/\b(sarah|john|maria|david)\b/.test(t)) return false;
  return true;
}

function extractDirectiveHead(text: string) {
  const t = (text || '').trim();
  if (!t) return '';
  const firstLine = t.split('\n')[0] ?? t;
  const head = firstLine.slice(0, 320);
  const colon = head.indexOf(':');
  if (colon > 0 && colon < 180) return head.slice(0, colon).trim();
  return head.trim();
}

function extractDirectiveWindow(text: string) {
  const t = (text || '').trim();
  if (!t) return '';
  // Many users paste long assistant text after a ":"; include a small window after it.
  return t.slice(0, 700).trim();
}

function explicitlyTargetsAllan(text: string) {
  const head = extractDirectiveHead(text);
  const window = extractDirectiveWindow(text);
  const scope = /\ballan\b/i.test(head) ? head : window;
  if (!/\ballan\b/i.test(scope)) return false;
  if (/\bappearance\b/i.test(scope)) return true;
  if (/\b(face|hair|clothing|shoes|hat|accessories)\b/i.test(scope)) return true;
  if (/\b(update|edit|change|set|replace|write)\b/i.test(scope)) return true;
  return false;
}

function coerceAppearanceValue(value: unknown) {
  const cleaned = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
  const keys: (keyof CanonCharacterAppearance)[] = ['face', 'hair', 'clothing', 'shoes', 'hat', 'accessories'];

  const parseExplicitFields = (text: string) => {
    const t = stripMarkdownLike(text);
    if (!t) return null;
    const get = (label: string) => {
      const re = new RegExp(`\\b${label}\\s*:\\s*([^,.;\\n]+)`, 'i');
      const m = t.match(re);
      const v = m?.[1] ? normalizeWhitespace(m[1]) : '';
      return isMeaningfulFieldValue(v) ? clamp(v, 180) : '';
    };
    const out: CanonCharacterAppearance = {};
    const face = get('face');
    const hair = get('hair');
    const clothing = get('clothing');
    const shoes = get('shoes');
    const hat = get('hat');
    const accessories = get('accessories');
    if (face) out.face = face;
    if (hair) out.hair = hair;
    if (clothing) out.clothing = clothing;
    if (shoes) out.shoes = shoes;
    if (hat) out.hat = hat;
    if (accessories) out.accessories = accessories;
    return Object.keys(out).length ? out : null;
  };

  const extractSentence = (text: string, re: RegExp) => {
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/g)
      .map(s => s.trim())
      .filter(Boolean);
    const found = sentences.find(s => re.test(s));
    return found ?? '';
  };

  const fromFreeText = (text: string): CanonCharacterAppearance | null => {
    const t = stripMarkdownLike(text || '');
    if (!t) return null;
    const explicit = parseExplicitFields(t);
    if (explicit) return explicit;
    const appearance: CanonCharacterAppearance = {};
    const hair = extractSentence(t, /\b(slightly\s+receding\s+hairline|hairline|hair)\b/i);
    const clothing = extractSentence(t, /\b(wearing|hoodie|jeans|jacket|t-?shirt|shirt|clothing|outfit)\b/i);
    const accessories = extractSentence(t, /\b(satchel|bag|backpack|notebook|books?)\b/i);
    const faceBits = [
      extractSentence(t, /\b(thoughtful|melancholic|fear|scared|expression|eyes?|face)\b/i),
      extractSentence(t, /\b(scar|dark circles?)\b/i),
    ].filter(Boolean);
    const face = faceBits.length ? [...new Set(faceBits)].join(' ') : '';

    if (isMeaningfulFieldValue(hair)) appearance.hair = clamp(hair.replace(/\.$/, ''), 180);
    if (isMeaningfulFieldValue(clothing)) appearance.clothing = clamp(clothing.replace(/\.$/, ''), 180);
    if (isMeaningfulFieldValue(accessories)) appearance.accessories = clamp(accessories.replace(/\.$/, ''), 180);
    if (isMeaningfulFieldValue(face)) appearance.face = clamp(face.replace(/\.$/, ''), 220);

    return Object.keys(appearance).length ? appearance : null;
  };

  if (Array.isArray(value)) {
    const strings = value
      .filter(v => typeof v === 'string')
      .map(v => (v as string).trim())
      .filter(Boolean);
    if (strings.length > 20 && strings.every(s => s.length === 1)) {
      const joined = strings.join('').trim();
      return joined ? fromFreeText(joined) ?? { clothing: joined } : null;
    }
    const joined = strings.join('. ').trim();
    return joined ? fromFreeText(joined) ?? { clothing: joined } : null;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: CanonCharacterAppearance = {};
    for (const k of keys) {
      const v = cleaned(obj[k as string]);
      if (isMeaningfulFieldValue(v)) out[k] = clamp(v, 180);
    }
    return Object.keys(out).length ? out : null;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    return fromFreeText(s) ?? { clothing: clamp(stripMarkdownLike(s), 180) };
  }

  return null;
}

function extractAllanDescriptionFromDiscussion(discussion: string) {
  const text = (discussion || '').trim();
  if (!text) return '';
  // Avoid brittle quote parsing (users often include nested quotes like 5'10").
  return extractAllanDescription(text);
}

function buildDeterministicAllanPatch(input: {
  current: Record<string, unknown>;
  discussion: string;
}) : JsonPatchOperation[] | null {
  const characters = (input.current as any)?.characters;
  const allanIndex = findCharacterIndexByName(characters, 'Allan');
  const desc = extractAllanDescriptionFromDiscussion(input.discussion);
  if (!desc) return null;
  const appearance = coerceAppearanceValue(desc);

  const ops: JsonPatchOperation[] = [];
  if (!Array.isArray(characters)) {
    ops.push({ op: 'add', path: '/characters', value: [] });
  }
  if (allanIndex === null) {
    const newChar: CanonCharacter = {
      name: 'Allan',
      role: 'Protagonist',
      description: desc,
      appearance: appearance ?? undefined,
    };
    ops.push({ op: 'add', path: '/characters/-', value: newChar });
    return ops;
  }
  ops.push({ op: 'replace', path: `/characters/${allanIndex}/description`, value: desc });
  if (appearance && Object.keys(appearance).length > 0) {
    const currentChar = Array.isArray(characters) ? (characters as any[])[allanIndex] : null;
    const existing =
      currentChar?.appearance && typeof currentChar.appearance === 'object' && !Array.isArray(currentChar.appearance)
        ? (currentChar.appearance as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(appearance)) {
      if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
    }
    ops.push({ op: 'replace', path: `/characters/${allanIndex}/appearance`, value: merged });
  }
  return ops;
}

function normalizeCanonPatch(input: {
  patch: JsonPatchOperation[];
  current: Record<string, unknown>;
  userRequest: string;
  discussion: string;
}) {
  const characters = (input.current as any)?.characters;
  const allanIndex = findCharacterIndexByName(characters, 'Allan');
  const mentionsOnlyAllan = looksLikeUserOnlyMentionsAllan(input.userRequest) || explicitlyTargetsAllan(input.userRequest);

  const normalized: JsonPatchOperation[] = [];
  for (const op of input.patch) {
    if (!op || typeof op !== 'object') continue;
    const path = String((op as any).path ?? '');
    if (!path.startsWith('/')) continue;

    // If the user is only asking about Allan, do not allow "replace the entire characters list"
    // (a common failure mode that corrupts other characters).
    if (mentionsOnlyAllan && path === '/characters') {
      const currentHasCharacters = Array.isArray(characters);
      // Allow creating the container only when missing.
      if (op.op === 'add' && !currentHasCharacters && Array.isArray((op as any).value) && (op as any).value.length === 0) {
        normalized.push(op);
      }
      continue;
    }

    if (mentionsOnlyAllan && path.startsWith('/characters/') && allanIndex !== null) {
      // Only allow Allan's subtree (or redirects handled below).
      const isAllanSubtree = path.startsWith(`/characters/${allanIndex}/`) || path === `/characters/${allanIndex}`;
      const idx = parseCharacterIndexFromPath(path);
      if (idx === null && !isAllanSubtree) {
        // Blocks "/characters/-" or other non-index updates when Allan-only.
        continue;
      }
    }

    // If the user only mentions Allan, don't allow patching other characters by index.
    const idx = parseCharacterIndexFromPath(path);
    if (mentionsOnlyAllan && idx !== null && Array.isArray(characters)) {
      const name = getCharacterName((characters as any[])[idx]);
      if (name && name.toLowerCase() !== 'allan') {
        // If the value itself references Allan, redirect to Allan when possible.
        const valueText = isAddOrReplace(op) && typeof (op as any).value === 'string' ? String((op as any).value) : '';
        if (allanIndex !== null && /allan/i.test(valueText)) {
          const rewrittenPath = path.replace(/^\/characters\/\d+/, `/characters/${allanIndex}`);
          const nextOp: any = { ...op, path: rewrittenPath };
          normalized.push(nextOp);
        }
        continue;
      }
    }

    // Ensure appearance stays object
    if (/\/appearance$/.test(path) && isAddOrReplace(op)) {
      const coerced = coerceAppearanceValue((op as any).value);
      if (coerced && Object.keys(coerced).length > 0) normalized.push({ ...op, value: coerced } as any);
      continue;
    }

    // Ensure appearance.* stays string
    if (/\/appearance\/(face|hair|clothing|shoes|hat|accessories)$/.test(path) && isAddOrReplace(op)) {
      const v = typeof (op as any).value === 'string' ? String((op as any).value).trim() : '';
      if (!v) continue;
      normalized.push({ ...op, value: v } as any);
      continue;
    }

    normalized.push(op);
  }

  return normalized.slice(0, 30);
}

function buildSystemPrompt() {
  return [
    'You are an assistant helping the user UPDATE their story canon.',
    '',
    'Return ONLY a valid JSON object with this schema:',
    '{',
    '  "patch": [{ "op": "add"|"replace"|"remove", "path": string, "value": any }],',
    '  "questions": [{ "id": string, "question": string, "default": string }], // optional',
    '  "assumptions": string[] // optional',
    '}',
    '',
    'Rules:',
    '- The patch applies to CURRENT_CANON_JSON (the canon asset content).',
    '- Preserve existing information unless the user explicitly changes it.',
    '- If the user request is ambiguous, ask 1-3 questions in "questions" and return an empty "patch".',
    '- Use JSON Pointer paths like "/tone", "/themes/0", "/characters/1/appearance".',
    '- characters[].appearance is an OBJECT with optional string keys: face, hair, clothing, shoes, hat, accessories.',
    '- Keep patch small (<= 30 ops). Avoid removing large sections unless explicitly requested.',
    '- Return ONLY JSON. No markdown, no code fences.',
  ].join('\n');
}

function splitDiscussionContext(input: string) {
  const marker = '\n\nDISCUSSION_CONTEXT:\n';
  const idx = (input || '').indexOf(marker);
  if (idx < 0) return { userRequest: (input || '').trim(), discussion: '' };
  const userRequest = (input || '').slice(0, idx).trim();
  const discussion = (input || '').slice(idx + marker.length).trim();
  return { userRequest, discussion };
}

function buildJsonRepairPrompt(input: { invalidOutput: string; error?: string }) {
  return [
    'You are a strict JSON repair assistant.',
    '',
    'Return ONLY a valid JSON object that matches this schema:',
    '{ "patch": [{ "op": "add"|"replace"|"remove", "path": string, "value": any }], "questions": [{ "id": string, "question": string, "default": string }], "assumptions": string[] } (questions/assumptions optional)',
    '',
    input.error ? `PARSE_ERROR: ${input.error}` : '',
    '',
    'Rules:',
    '- Return ONLY JSON (no markdown, no code fences).',
    '- If the original output is not a patch, set "patch" to [] and put clarifying questions in "questions".',
    '',
    'INVALID_OUTPUT:',
    input.invalidOutput,
    '',
    'JSON:',
  ]
    .filter(Boolean)
    .join('\n');
}

export const updateCanonSkill: Skill = {
  name: 'updateCanon',
  description: 'Discusses canon updates and compiles them into a proposal on demand',
  keywords: ['canon', 'update canon', 'edit canon', 'change canon'],
  examples: ['Update canon', 'Edit canon: Allan uses an AK-47', 'Change the canon locations to grassland'],

  async execute(context: SkillContext, input: string): Promise<SkillResult> {
    try {
      const compileMarker = 'CANON_COMPILE:\n';
      const isCompile = (input || '').startsWith(compileMarker);
      const body = isCompile ? (input || '').slice(compileMarker.length) : (input || '');
      const { userRequest, discussion } = splitDiscussionContext(body);

      // 1) Select canon asset (focused one if it is canon_text, else latest).
      let focusedCanon: Asset | null = null;
      if (context.assetId) {
        const focusedRes = await executeTool('fetchAsset', context, { assetId: context.assetId });
        if (focusedRes.ok) {
          const a = focusedRes.data as Asset;
          if (a.asset_type === 'canon_text' && a.status !== 'deprecated') focusedCanon = a;
        }
      }

      const canonAssetsRes = await executeTool('fetchProjectAssets', context, { assetType: 'canon_text' });
      if (!canonAssetsRes.ok) return { success: false, message: canonAssetsRes.error.message };
      const canonAssets = canonAssetsRes.data as Asset[];
      const latestCanon = pickLatestNonDeprecated(canonAssets);

      const canon = focusedCanon ?? latestCanon;
      if (!canon) {
        return {
          success: true,
          message: 'No canon found yet. Type /extract-canon first (or ask me to extract canon from your story).',
        };
      }

      // === INTENT MODE DETECTION ===
      // Check if user input is a structured directive (Direction Mode) or rejection with correction (Correction Mode)
      const intentMode = detectUserIntentMode(userRequest);
      
      // DIRECTION MODE: User provides explicit field values (e.g., "Fix with: Face: pale skin, Hair: brown")
      // Bypass chat loop and jump straight to proposal generation
      if (intentMode === 'direction' && !isCompile) {
        const directionData = extractDirectionData(userRequest);
        if (directionData && Object.keys(directionData).length > 0) {
          // User has provided explicit field values; generate proposal directly
          const current = canonContent(canon);
          const characters = (current as any)?.characters;
          const allanIndex = findCharacterIndexByName(characters, 'Allan');
          
          if (allanIndex !== null && Array.isArray(characters)) {
            const patch: JsonPatchOperation[] = [];
            const allan = (characters as any[])[allanIndex];
            const existingAppearance =
              allan && typeof allan === 'object' && (allan as any).appearance && typeof (allan as any).appearance === 'object' && !Array.isArray((allan as any).appearance)
                ? (allan as any).appearance
                : null;
            
            if (!existingAppearance) {
              patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance`, value: {} });
            }
            
            // Apply user-provided values directly
            for (const [key, value] of Object.entries(directionData)) {
              patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance/${key}`, value });
            }
            
            const fieldsList = Object.keys(directionData).join(', ');
            const proposal = {
              kind: 'asset_patch' as const,
              assetId: canon.id,
              baseAssetVersionId: canon.current_asset_version_id ?? null,
              summary: `Update canon: ${canon.title ?? canon.id.slice(0, 8)}`,
              patch,
              metadata: {
                applyStrategy: 'canon_update',
                canonAssetId: canon.id,
              },
            };
            
            return {
              success: true,
              message: `I've prepared Allan's appearance updates (${fieldsList}). Type /review to preview, then /apply to save.`,
              proposal,
              data: { canonAssetId: canon.id, patch, intentMode },
            };
          }
        }
      }
      
      // CORRECTION MODE: User rejects previous proposal and provides new directive
      // Extract the correction and treat it as a new direction
      if (intentMode === 'correction' && !isCompile) {
        // Try multiple strategies to extract new values from correction
        // Strategy 1: Strip rejection prefix if it matches expected patterns
        let extractInput = userRequest.replace(/^(no(?:\s|,|$)|that'?s wrong|please redo|incorrect|not what|i don't like)/i, '').trim();
        
        // Strategy 2: If no prefix match, try to extract any field values directly
        // (user might say "face: X is wrong" where field value IS the body)
        if (extractInput === userRequest.trim()) {
          extractInput = userRequest; // Use full input for extraction
        }
        
        const correctionData = extractDirectionData(extractInput);
        
        if (correctionData && Object.keys(correctionData).length > 0) {
          const current = canonContent(canon);
          const characters = (current as any)?.characters;
          const allanIndex = findCharacterIndexByName(characters, 'Allan');
          
          if (allanIndex !== null && Array.isArray(characters)) {
            const patch: JsonPatchOperation[] = [];
            const allan = (characters as any[])[allanIndex];
            const existingAppearance =
              allan && typeof allan === 'object' && (allan as any).appearance && typeof (allan as any).appearance === 'object' && !Array.isArray((allan as any).appearance)
                ? (allan as any).appearance
                : null;
            
            if (!existingAppearance) {
              patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance`, value: {} });
            }
            
            for (const [key, value] of Object.entries(correctionData)) {
              patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance/${key}`, value });
            }
            
            const fieldsList = Object.keys(correctionData).join(', ');
            const proposal = {
              kind: 'asset_patch' as const,
              assetId: canon.id,
              baseAssetVersionId: canon.current_asset_version_id ?? null,
              summary: `Update canon: ${canon.title ?? canon.id.slice(0, 8)}`,
              patch,
              metadata: {
                applyStrategy: 'canon_update',
                canonAssetId: canon.id,
              },
            };
            
            return {
              success: true,
              message: `Understood—I've adjusted Allan's ${fieldsList}. Type /review to preview, then /apply to save.`,
              proposal,
              data: { canonAssetId: canon.id, patch, intentMode },
            };
          }
        }
        // If correction mode was detected but no valid data extracted, signal it to draft mode
        // by including correction context in the userRequest for the LLM
      }

      // Draft mode: keep chat smooth (no strict schema). We only compile a patch on /review or /apply.
      if (!isCompile) {
        const current = canonContent(canon);
        const allanIndex = findCharacterIndexByName((current as any)?.characters, 'Allan');
        const allan =
          allanIndex !== null && Array.isArray((current as any)?.characters)
            ? (current as any).characters[allanIndex]
            : null;
        const currentAllan = allan && typeof allan === 'object' ? JSON.stringify(allan, null, 2).slice(0, 1400) : '';

        // If the user asks to update specific appearance fields, respond only with those fields.
        const requestedKeys = detectRequestedAppearanceKeys(userRequest);
        const wantsSpecificFields =
          requestedKeys.length > 0 &&
          (/\b(fill|suggest|provide|update|set|change)\b/i.test(userRequest) ||
            /\b(only|just|just these|only these)\b/i.test(userRequest) ||
            /\bappearance\b/i.test(userRequest));

        const chatPrompt = [
          'You are an in-app Copilot helping the user edit their STORY CANON.',
          '',
          'Goals:',
          '- Discuss changes conversationally.',
          wantsSpecificFields
            ? `- The user asked to update specific fields for Allan: ${requestedKeys.join(', ')}.`
            : '- Summarize the intended canon edits as short bullet points.',
          wantsSpecificFields
            ? '- Provide only the requested fields as key/value lines (no other text).'
            : '- Ask at most 2 clarifying questions if needed.',
          '',
          'Formatting:',
          '- Plain text only (NO markdown formatting like **bold**, *italics*, headings, or numbered lists).',
          wantsSpecificFields
            ? '- Output MUST be ONLY lines like "face: ..." and "hair: ...". Nothing else.'
            : '- Use short paragraphs and "-" bullets when helpful.',
          '- Do not start with filler like "Okay, I understand" or "Let’s refine". Start directly with the content.',
          '',
          'Rules:',
          '- Do NOT output JSON.',
          '- Do NOT mention internal tools.',
          '- Keep it short and practical.',
          wantsSpecificFields ? '- ALWAYS provide concrete, real descriptions for requested fields. Never output "Unspecified" or "Unknown".' : '',
          wantsSpecificFields ? '- Do NOT rewrite the full description.' : '',
          '',
          `CURRENT_CANON_ASSET_ID: ${canon.id}`,
          currentAllan ? `\nCURRENT_ALLAN:\n${currentAllan}\n` : '',
          `USER_REQUEST:\n${userRequest}\n`,
          discussion ? `DISCUSSION_CONTEXT:\n${discussion.slice(0, 1800)}\n` : '',
          'Assistant:',
        ]
          .filter(Boolean)
          .join('\n');

        const model =
          (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
          'gemma3:1b';
        const llmRes = await executeTool('llmGenerateText', context, { model, prompt: chatPrompt, stream: false });
        const assistantReplyRaw = llmRes.ok ? String((llmRes.data as any)?.text ?? '').trim() : '';
        const assistantReply = wantsSpecificFields
          ? (() => {
              const parsed = extractAppearanceKeyValues(assistantReplyRaw);
              const fallbackText = buildAppearanceFallbackLines({ requestedKeys, allan, discussionText: discussion });
              const fallback = extractAppearanceKeyValues(fallbackText);
              
              // Build the final output with only requested keys, falling back to generated suggestions
              const lines = requestedKeys
                .map(k => {
                  const v = parsed[k] || fallback[k] || '';
                  return isMeaningfulFieldValue(v) ? `${k}: ${v}` : '';
                })
                .filter(Boolean);
              
              // If we got some lines from parsing, use them; otherwise use the fallback text or raw response
              if (lines.length > 0) {
                return lines.join('\n');
              }
              
              // Fallback: use the generated suggestions
              return fallbackText || assistantReplyRaw;
            })()
          : assistantReplyRaw;
        const msg =
          (assistantReply || 'Got it.') +
          '\n\nWhen you’re ready, type /review to generate a proposal (nothing is saved until /apply).';

        return {
          success: true,
          message: msg,
          data: {
            canonDraft: {
              canonAssetId: canon.id,
              userRequest,
              assistantReply: assistantReply || 'Got it.',
              updatedAt: new Date().toISOString(),
            },
          },
        };
      }

      // 3) Ask the model for a patch (strict JSON).
      const current = canonContent(canon);

      // If the request is clearly about specific appearance fields, compile a deterministic field-only patch
      // from the discussion transcript (which contains the assistant's suggested key/value lines).
      const requestedKeys = (() => {
        const fromRequest = detectRequestedAppearanceKeys(userRequest);
        if (fromRequest.length) return fromRequest;
        const fromDiscussion = detectRequestedAppearanceKeys(discussion || '');
        return fromDiscussion;
      })();
      const requestWindow = `${userRequest}\n${discussion || ''}`.slice(0, 1200);
      const wantsSpecificFields =
        requestedKeys.length > 0 &&
        (/\bunspecified\b/i.test(requestWindow) ||
          /\b(fill|suggest|provide|update|set|change)\b/i.test(requestWindow) ||
          /\bappearance\b/i.test(requestWindow));

      if (wantsSpecificFields) {
        const characters = (current as any)?.characters;
        const allanIndex = findCharacterIndexByName(characters, 'Allan');
        const allan =
          allanIndex !== null && Array.isArray(characters)
            ? (characters as any[])[allanIndex]
            : null;
        const suggested = extractAppearanceKeyValues(discussion || '');
        const fallbackText = buildAppearanceFallbackLines({ requestedKeys, allan, discussionText: discussion });
        const fallback = extractAppearanceKeyValues(fallbackText);
        const picked: Partial<Record<keyof CanonCharacterAppearance, string>> = {};
        for (const k of requestedKeys) {
          const v = suggested[k] || fallback[k];
          if (typeof v === 'string' && isMeaningfulFieldValue(v)) picked[k] = v;
        }

        if (allanIndex !== null && Object.keys(picked).length > 0) {
          const patch: JsonPatchOperation[] = [];
          const existingAppearance =
            allan && typeof allan === 'object' && (allan as any).appearance && typeof (allan as any).appearance === 'object' && !Array.isArray((allan as any).appearance)
              ? (allan as any).appearance
              : null;
          if (!existingAppearance) {
            patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance`, value: {} });
          }
          for (const [k, v] of Object.entries(picked)) {
            // Use "add" so it works whether the field exists yet or not.
            patch.push({ op: 'add', path: `/characters/${allanIndex}/appearance/${k}`, value: v });
          }

          const proposal = {
            kind: 'asset_patch' as const,
            assetId: canon.id,
            baseAssetVersionId: canon.current_asset_version_id ?? null,
            summary: `Update canon: ${canon.title ?? canon.id.slice(0, 8)}`,
            patch,
            metadata: {
              applyStrategy: 'canon_update',
              canonAssetId: canon.id,
            },
          };
          return {
            success: true,
            message: `Drafted canon updates for Allan (${requestedKeys.join(', ')}). Type /review to preview the proposal, then /apply to save it.`,
            proposal,
            data: { canonAssetId: canon.id, patch },
          };
        }
      }

      // Fast-path: if the user explicitly wants to update Allan (common case),
      // avoid patching the wrong character by generating a deterministic Allan-only patch.
      if (explicitlyTargetsAllan(userRequest)) {
        const sourceText = discussion?.trim() ? discussion : userRequest;
        const deterministic = buildDeterministicAllanPatch({ current, discussion: sourceText });
        if (deterministic?.length) {
          const proposal = {
            kind: 'asset_patch' as const,
            assetId: canon.id,
            baseAssetVersionId: canon.current_asset_version_id ?? null,
            summary: `Update canon: ${canon.title ?? canon.id.slice(0, 8)}`,
            patch: deterministic,
            metadata: {
              applyStrategy: 'canon_update',
              canonAssetId: canon.id,
            },
          };
          return {
            success: true,
            message:
              'Drafted canon updates for Allan. Type /review to preview the proposal, then /apply to save it as a new canon version.',
            proposal,
            data: { canonAssetId: canon.id, patch: deterministic },
          };
        }
      }
      const prompt = [
        buildSystemPrompt(),
        '',
        `CANON_ASSET_ID: ${canon.id}`,
        '',
        'CURRENT_CANON_JSON:',
        JSON.stringify(current ?? {}, null, 2).slice(0, 9000),
        '',
        discussion ? 'DISCUSSION_CONTEXT:\n' + discussion.slice(0, 3500) : '',
        '',
        'USER_REQUEST:',
        userRequest,
        '',
        'JSON:',
      ].join('\n');

      const model =
        (import.meta.env.VITE_COPILOT_CANON_MODEL as string | undefined) ||
        (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
        'gemma3:1b';

      const llmRes = await executeTool('llmGenerateText', context, { model, prompt, stream: false });
      if (!llmRes.ok) return { success: false, message: llmRes.error.message };
      const raw = String((llmRes.data as any)?.text ?? '');

      let parsed: CanonPatchResponse | null = null;
      try {
        const extracted = extractFirstJsonObjectLenient(raw);
        parsed = isCanonPatchResponse(extracted) ? extracted : null;
      } catch (err) {
        const repairModel =
          (import.meta.env.VITE_COPILOT_PLANNER_MODEL as string | undefined) ||
          (import.meta.env.VITE_COPILOT_CANON_MODEL as string | undefined) ||
          (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
          'gemma3:1b';
        const repairPrompt = buildJsonRepairPrompt({
          invalidOutput: raw.slice(0, 8000),
          error: err instanceof Error ? err.message : String(err),
        });
        const repairRes = await executeTool('llmGenerateText', context, { model: repairModel, prompt: repairPrompt, stream: false });
        if (!repairRes.ok) {
          return {
            success: false,
            message: 'Copilot returned an invalid response and repair failed. Try again with simpler bullet points.',
            data: { raw, repairError: repairRes.error.message },
          };
        }
        const repairedRaw = String((repairRes.data as any)?.text ?? '');
        try {
          const extracted = extractFirstJsonObjectLenient(repairedRaw);
          parsed = isCanonPatchResponse(extracted) ? extracted : null;
        } catch (err2) {
          return {
            success: false,
            message: 'Copilot returned an invalid response. Try again with simpler bullet points.',
            data: { raw, repairedRaw, error: err2 instanceof Error ? err2.message : String(err2) },
          };
        }
      }

      if (!parsed) {
        const repairModel =
          (import.meta.env.VITE_COPILOT_PLANNER_MODEL as string | undefined) ||
          (import.meta.env.VITE_COPILOT_CANON_MODEL as string | undefined) ||
          (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
          'gemma3:1b';
        const repairPrompt = buildJsonRepairPrompt({ invalidOutput: raw.slice(0, 8000), error: 'Schema validation failed' });
        const repairRes = await executeTool('llmGenerateText', context, { model: repairModel, prompt: repairPrompt, stream: false });
        if (!repairRes.ok) {
          return {
            success: false,
            message: 'Copilot returned an invalid response. Try again with simpler bullet points.',
            data: { raw, repairError: repairRes.error.message },
          };
        }
        const repairedRaw = String((repairRes.data as any)?.text ?? '');
        let repairedParsed: unknown;
        try {
          repairedParsed = extractFirstJsonObjectLenient(repairedRaw);
        } catch (err2) {
          return {
            success: false,
            message: 'Copilot returned an invalid response. Try again with simpler bullet points.',
            data: { raw, repairedRaw, error: err2 instanceof Error ? err2.message : String(err2) },
          };
        }
        if (!isCanonPatchResponse(repairedParsed)) {
          return {
            success: false,
            message: 'Copilot returned an invalid response. Try again with simpler bullet points.',
            data: { raw, repairedRaw },
          };
        }
        parsed = repairedParsed;
      }

      const questions = Array.isArray(parsed.questions)
        ? parsed.questions
            .filter(q => q && typeof q === 'object')
            .map(q => q as { id?: unknown; question?: unknown; default?: unknown })
            .map(q => ({
              id: typeof q.id === 'string' ? q.id : '',
              question: typeof q.question === 'string' ? q.question : '',
              default: typeof q.default === 'string' ? q.default : '',
            }))
            .filter(q => q.id && q.question)
            .slice(0, 3)
        : [];

      const patch = Array.isArray(parsed.patch) ? parsed.patch.slice(0, 30) : [];
      if (questions.length && patch.length === 0) {
        return {
          success: true,
          message: 'I need a bit more info to update the canon.',
          plan: {
            intent: 'Update canon',
            requires_confirmation: false,
            questions,
            steps: [],
          },
        };
      }

      if (!patch.length) {
        return {
          success: false,
          message: 'No canon changes were proposed. Try again with explicit add/change/remove instructions.',
          data: { raw },
        };
      }

      // Deterministic fixups for common failure modes (wrong character index, wrong types).
      let finalPatch = normalizeCanonPatch({ patch, current, userRequest, discussion });
      if (looksLikeUserOnlyMentionsAllan(userRequest)) {
        // If the model didn't produce an Allan-specific patch (or produced an empty/unsafe one), prefer deterministic patch.
        const touchesAllan = finalPatch.some(op => String((op as any)?.path ?? '').includes('/characters/') && /allan/i.test(JSON.stringify((op as any).value ?? '')));
        if (!finalPatch.length || (Array.isArray((current as any).characters) && !touchesAllan)) {
          const deterministic = buildDeterministicAllanPatch({ current, discussion });
          if (deterministic) finalPatch = deterministic;
        }
      }

      const proposal = {
        kind: 'asset_patch' as const,
        assetId: canon.id,
        baseAssetVersionId: canon.current_asset_version_id ?? null,
        summary: `Update canon: ${canon.title ?? canon.id.slice(0, 8)}`,
        patch: finalPatch,
        metadata: {
          applyStrategy: 'canon_update',
          canonAssetId: canon.id,
        },
      };

      return {
        success: true,
        message:
          'Drafted canon updates. Type /review to preview the proposal, then /apply to save it as a new canon version.',
        proposal,
        data: { canonAssetId: canon.id, patch },
      };
    } catch (error) {
      console.error('Update canon skill error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sorry, I encountered an error.',
      };
    }
  },
};
