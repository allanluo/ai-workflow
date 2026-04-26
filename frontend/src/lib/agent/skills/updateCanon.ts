import type { Asset } from '../../api';
import type { JsonPatchOperation, Skill, SkillContext, SkillResult } from '../types';
import { extractFirstJsonObjectLenient } from '../llmClient';
import { executeTool } from '../tools';
import { isCanonLike } from '../context/buildContext';

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
function extractField(input: string, key: string): string {
  const t = (input || '').trim();
  if (!t) return '';
  
  // 1. Try quoted match first (e.g., face: "pale skin")
  const quotedRe = new RegExp(`\\b${key}\\s*[:=-]\\s*["']([^"']+)["']`, 'i');
  let m = t.match(quotedRe);
  if (m?.[1]) {
    return clamp(normalizeWhitespace(m[1]), 180);
  }

  // 2. Try generic match until next known key or chat label
  const keyEsc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const otherKeys = APPEARANCE_KEYS.filter(k => k !== key).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // Regex that allows multi-line values and stops at the next known key or end of input
  const re = new RegExp(`\\b${keyEsc}\\s*[:=-]\\s*(.*?)(?=\\s*\\b(?:${otherKeys})\\s*[:=-]|\\s*(?:USER|ASSISTANT|SYSTEM|PROPOSAL|CHANGES|CLARIFICATIONS)\\s*[:=-]|$)`, 'is');
  m = t.match(re);
  let cleaned = m?.[1] ? normalizeWhitespace(m[1]) : '';
  
  // Aggressively strip chat noise: find the first occurrence of any chat label and cut everything after it
  const chatLabelIdx = cleaned.search(/\b(USER|ASSISTANT|COPILOT|SYSTEM|CLARIFICATIONS|DISCUSSION_CONTEXT)\s*:/i);
  if (chatLabelIdx >= 0) {
    cleaned = cleaned.slice(0, chatLabelIdx).trim();
  }
  
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
  character: any;
  discussionText?: string;
}) {
  const requested = input.requestedKeys ?? [];
  const char = input.character ?? null;
  const descFromCanon = typeof char?.description === 'string' ? stripMarkdownLike(char.description) : '';
  const descFromDiscussion = input.discussionText ? extractCharacterDescription(input.discussionText) : '';
  const desc = descFromDiscussion || descFromCanon;
  const existing = char?.appearance && typeof char.appearance === 'object' && !Array.isArray(char.appearance) ? char.appearance : {};

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
  t = t.replace(/^(okay|alright|sure|great|i understand|here'?s a proposal)\b[.:!,-]?\s*/i, '');
  t = t.replace(/^let['’]s\b[^.?!]*[.?!]\s*/i, '');
  return t.trim();
}

function stripChatLabels(text: string) {
  let t = String(text || '').trim();
  // Remove labels like ASSISTANT:, USER:, SYSTEM:, DISCUSSION_CONTEXT:, CLARIFICATIONS:
  // Also remove anything that looks like an LLM responding to itself or a conversation log
  t = t.replace(/\b(ASSISTANT|USER|SYSTEM|DISCUSSION_CONTEXT|CLARIFICATIONS|PROPOSAL|CHANGES)\s*:.*$/is, '');
  // Also handle cases where they are in the middle of a line
  t = t.replace(/\b(ASSISTANT|USER|SYSTEM|DISCUSSION_CONTEXT|CLARIFICATIONS)\s*:/gi, '');
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
  
  // Reject exact matches and placeholders that mean "missing"
  const placeholders = [
    'unspecified', 
    'unknown', 
    'not described', 
    'not specified', 
    'n/a', 
    'none', 
    'not mentioned',
    'none given',
    'unavailable'
  ];
  
  if (placeholders.includes(lower) || placeholders.some(p => lower.startsWith(p + ' '))) return false;
  
  // Also reject if it's ONLY describing the problem without providing real value
  if (/\bunspecified\b.*only\b|only.*\bunspecified\b/i.test(v)) return false;
  if (/^as described in.*$/i.test(v)) return false; // Common AI hallucination: "As described in input"
  
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

function extractCharacterDescription(text: string, charName?: string) {
  const raw = stripMarkdownLike(text);
  if (!raw) return '';

  const nameToFind = (charName || 'Allan').toLowerCase();
  const descBlock = extractBetween(raw, new RegExp(`\\b${nameToFind}:?\\s+description:\\s*`, 'i'), [
    /\bappearance:\s*/i,
    /\bpersonality:\s*/i,
    /\brelationships?:\s*/i,
  ]);
  if (descBlock) {
    return clamp(stripChatLabels(stripChattyPreamble(descBlock)), 420);
  }

  const idx = raw.toLowerCase().indexOf(`${nameToFind} is`);
  if (idx >= 0) {
    const tail = raw.slice(idx);
    const stop = extractBetween(tail, new RegExp(`^${nameToFind} is\\s*`, 'i'), [/\bappearance:\s*/i, /\bpersonality:\s*/i, /\brelationships?:\s*/i]);
    const candidate = (stop ? `${charName || 'Allan'} is ${stop}` : tail).trim();
    return clamp(stripChatLabels(stripChattyPreamble(candidate)), 420);
  }

  return clamp(stripChatLabels(stripChattyPreamble(raw)), 420);
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
  
  // Try exact match first
  let idx = characters.findIndex(c => getCharacterName(c).toLowerCase() === wanted);
  if (idx >= 0) return idx;
  
  // Try fuzzy match
  idx = characters.findIndex(c => {
    const n = getCharacterName(c).toLowerCase();
    return n.includes(wanted) || (n.length > 3 && wanted.includes(n));
  });
  
  return idx >= 0 ? idx : null;
}

function findPrimaryCharacterIndex(characters: unknown): number | null {
  if (!Array.isArray(characters)) return null;
  
  // 1. First one named Allan (legacy support)
  const byName = findCharacterIndexByName(characters, 'Allan');
  if (byName !== null) return byName;
  
  // 2. First one with role "protagonist"
  const byRole = characters.findIndex(c => 
    String(c?.role || '').toLowerCase().includes('protagonist')
  );
  if (byRole >= 0) return byRole;
  
  // 3. Fallback to index 0
  if (characters.length > 0) return 0;
  
  return null;
}

function resolveTargetCharacterIndex(characters: any[], userRequest: string): number {
  if (!Array.isArray(characters) || characters.length === 0) return 0;
  
  const text = (userRequest || '').toLowerCase();
  
  // 1. Check for specific names from the document
  for (let i = 0; i < characters.length; i++) {
    const name = getCharacterName(characters[i]).toLowerCase();
    if (name && name.length > 2 && text.includes(name)) return i;
  }
  
  // 2. Check for Role/Identity keywords
  for (let i = 0; i < characters.length; i++) {
    const identity = (characters[i].identity || '').toLowerCase();
    if (identity && identity.length > 3 && text.includes(identity)) return i;
  }
  
  // 3. Fallback to primary logic
  const primaryIdx = findPrimaryCharacterIndex(characters);
  return primaryIdx !== null ? primaryIdx : 0;
}

function looksLikeUserOnlyMentionsSingleCharacter(text: string, characters: any[]) {
  if (!Array.isArray(characters)) return false;
  const t = (extractDirectiveWindow(text) || '').toLowerCase();
  const mentionedIdxs: number[] = [];
  for (let i = 0; i < characters.length; i++) {
    const name = getCharacterName(characters[i]).toLowerCase();
    if (name && name.length > 2 && t.includes(name)) {
      mentionedIdxs.push(i);
    }
  }
  // If exactly one character is mentioned, we can assume them as the single target.
  return mentionedIdxs.length === 1;
}

function extractDirectiveWindow(text: string) {
  const t = (text || '').trim();
  if (!t) return '';
  return t.slice(0, 1200).trim();
}

function explicitlyTargetsSingleCharacter(text: string, characters: any[]) {
  if (!Array.isArray(characters)) return null;
  const t = stripMarkdownLike(text || '').toLowerCase();
  if (!t) return null;
  
  const mentionsAppearance = /\b(face|hair|clothing|shoes|hat|accessories|appearance)\b/.test(t);
  const mentionsUpdate = /\b(update|edit|change|set|replace|write|fix|suggestion)\b/.test(t);
  
  for (let i = 0; i < characters.length; i++) {
    const name = getCharacterName(characters[i]).toLowerCase();
    if (name && name.length > 2 && t.includes(name)) {
      if (t.includes(`${name}:`) || mentionsAppearance || mentionsUpdate) {
        return { index: i, name: getCharacterName(characters[i]) };
      }
    }
  }
  
  return null;
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

function extractCharacterDescriptionFromDiscussion(discussion: string, charName?: string) {
  const text = (discussion || '').trim();
  if (!text) return '';
  return extractCharacterDescription(text, charName);
}

function buildDeterministicCharacterPatch(input: {
  current: Record<string, unknown>;
  discussion: string;
}) : JsonPatchOperation[] | null {
  const characters = (input.current as any)?.characters || [];
  const target = explicitlyTargetsSingleCharacter(input.discussion, characters);
  if (!target) return null;
  
  const charIndex = target.index;
  const charName = target.name;
  const desc = extractCharacterDescriptionFromDiscussion(input.discussion, charName);
  if (!desc) return null;
  const appearance = coerceAppearanceValue(desc);

  const ops: JsonPatchOperation[] = [];
  ops.push({ op: 'replace', path: `/characters/${charIndex}/description`, value: desc });
  if (appearance && Object.keys(appearance).length > 0) {
    const currentChar = (characters as any[])[charIndex];
    const existing =
      currentChar?.appearance && typeof currentChar.appearance === 'object' && !Array.isArray(currentChar.appearance)
        ? (currentChar.appearance as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...existing };
    for (const [k, v] of Object.entries(appearance)) {
      if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
    }
    ops.push({ op: 'replace', path: `/characters/${charIndex}/appearance`, value: merged });
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
  const target = explicitlyTargetsSingleCharacter(input.userRequest + " " + input.discussion, Array.isArray(characters) ? characters : []);
  const mentionsOnlySingle = !!target || looksLikeUserOnlyMentionsSingleCharacter(input.userRequest + " " + input.discussion, Array.isArray(characters) ? characters : []);
  const targetIndex = target?.index ?? resolveTargetCharacterIndex(Array.isArray(characters) ? characters : [], input.userRequest + " " + input.discussion);
  const targetName = (target?.name || (Array.isArray(characters) && characters[targetIndex] ? getCharacterName(characters[targetIndex]) : '')).toLowerCase();

  const normalized: JsonPatchOperation[] = [];
  for (const op of input.patch) {
    if (!op || typeof op !== 'object') continue;
    const path = String((op as any).path ?? '');
    if (!path.startsWith('/')) continue;

    // If the user is only asking about a specific character, do not allow "replace the entire characters list"
    if (mentionsOnlySingle && path === '/characters') {
      const currentHasCharacters = Array.isArray(characters);
      if (op.op === 'add' && !currentHasCharacters && Array.isArray((op as any).value) && (op as any).value.length === 0) {
        normalized.push(op);
      }
      continue;
    }

    if (mentionsOnlySingle && path.startsWith('/characters/') && targetIndex !== null) {
      const isTargetSubtree = path.startsWith(`/characters/${targetIndex}/`) || path === `/characters/${targetIndex}`;
      const idx = parseCharacterIndexFromPath(path);
      if (idx === null && !isTargetSubtree) {
        continue;
      }
    }

    // Catch character index updates (e.g., /characters/2/face)
    const idx = parseCharacterIndexFromPath(path);
    if (mentionsOnlySingle && idx !== null && targetIndex !== null && idx !== targetIndex) {
      const rewrittenPath = path.replace(/^\/characters\/\d+/, `/characters/${targetIndex}`);
      const nextOp: any = { ...op, path: rewrittenPath };
      normalized.push(nextOp);
      continue;
    }

    // Fallback redirect if character name at idx is wrong but value mentions the intended target.
    if (idx !== null && Array.isArray(characters) && targetName) {
      const name = getCharacterName((characters as any[])[idx]);
      if (name && name.toLowerCase() !== targetName) {
        const valueText = isAddOrReplace(op) && typeof (op as any).value === 'string' ? String((op as any).value) : '';
        if (targetIndex !== null && valueText.toLowerCase().includes(targetName)) {
          const rewrittenPath = path.replace(/^\/characters\/\d+/, `/characters/${targetIndex}`);
          const nextOp: any = { ...op, path: rewrittenPath };
          normalized.push(nextOp);
          continue;
        }
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

    // Smart Redirect: if op is add /characters/- and it contains a character that already exists, replace it at that index.
    if (op.op === 'add' && path === '/characters/-' && typeof (op as any).value === 'object' && (op as any).value !== null) {
      const val = (op as any).value;
      const name = getCharacterName(val);
      if (name) {
        const existingIdx = findCharacterIndexByName(characters, name);
        if (existingIdx !== null) {
          // Use "replace" but target the existing index
          normalized.push({
            op: 'replace',
            path: `/characters/${existingIdx}`,
            value: val
          });
          continue;
        }
      }
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

      // 1) Select canon asset (focused one if it is canon-like, else latest).
      let focusedCanon: Asset | null = null;
      if (context.assetId) {
        const focusedRes = await executeTool('fetchAsset', context, { assetId: context.assetId });
        if (focusedRes.ok) {
          const a = focusedRes.data as Asset;
          const content = (a.current_version?.content as any);
          const isCanonLike = Array.isArray(content?.characters) || !!content?.summary;
          if (isCanonLike && a.status !== 'deprecated') focusedCanon = a;
        }
      }

      // Fetch all project assets and filter for canon-like ones locally since the fetch tool is limited to types
      const allAssetsRes = await executeTool('fetchProjectAssets', context, {});
      if (!allAssetsRes.ok) return { success: false, message: allAssetsRes.error.message };
      const allAssets = allAssetsRes.data as Asset[];
      const canonAssets = allAssets.filter(a => {
        return isCanonLike(a) && a.status !== 'deprecated';
      });
      
      const latestCanon = pickLatestNonDeprecated(canonAssets);

      const canon = focusedCanon ?? latestCanon;
      if (!canon) {
        return {
          success: true,
          message: 'No canon document found. Please select one or ask me to extract one.',
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
          const characters = (current as any)?.characters || [];
          const charIndex = resolveTargetCharacterIndex(characters, discussion || userRequest);
          
          if (charIndex !== null && Array.isArray(characters)) {
            const patch: JsonPatchOperation[] = [];
            const targetChar = (characters as any[])[charIndex];
            const existingAppearance =
              targetChar && typeof targetChar === 'object' && (targetChar as any).appearance && typeof (targetChar as any).appearance === 'object' && !Array.isArray((targetChar as any).appearance)
                ? (targetChar as any).appearance
                : null;
            
            if (!existingAppearance) {
              patch.push({ op: 'add', path: `/characters/${charIndex}/appearance`, value: {} });
            }
            
            // Apply user-provided values directly
            for (const [key, value] of Object.entries(directionData)) {
              patch.push({ op: 'add', path: `/characters/${charIndex}/appearance/${key}`, value });
            }
            
            const fieldsList = Object.keys(directionData).join(', ');
            
            // Apply normalization to catch index mismatches even in direction mode
            const finalPatch = normalizeCanonPatch({ 
              patch, 
              current, 
              userRequest, 
              discussion: discussion || userRequest 
            });

             const charName = getCharacterName(characters[charIndex]) || 'character';
             const characterNames = (characters as any[]).map(c => getCharacterName(c));
             const proposal = {
               kind: 'asset_patch' as const,
               assetId: canon.id,
               baseAssetVersionId: canon.current_asset_version_id ?? null,
               summary: `Update ${charName} in ${canon.title || 'Canon Document'}`,
               patch: finalPatch,
               metadata: {
                 applyStrategy: 'canon_update',
                 canonAssetId: canon.id,
                 characterNames,
               },
             };
             
             return {
               success: true,
               message: `I've prepared ${charName}'s appearance updates (${fieldsList}) in the document "${canon.title || 'Canon'}". Type /review to preview, then /apply to save.`,
               proposal,
               data: { canonAssetId: canon.id, patch: finalPatch, intentMode },
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
          const charIndex = resolveTargetCharacterIndex(characters, discussion || userRequest);
          
          if (charIndex !== null && Array.isArray(characters)) {
            const patch: JsonPatchOperation[] = [];
            const targetChar = (characters as any[])[charIndex];
            const existingAppearance =
              targetChar && typeof targetChar === 'object' && (targetChar as any).appearance && typeof (targetChar as any).appearance === 'object' && !Array.isArray((targetChar as any).appearance)
                ? (targetChar as any).appearance
                : null;
            
            if (!existingAppearance) {
              patch.push({ op: 'add', path: `/characters/${charIndex}/appearance`, value: {} });
            }
            
            for (const [key, value] of Object.entries(correctionData)) {
              patch.push({ op: 'add', path: `/characters/${charIndex}/appearance/${key}`, value });
            }
            
            const fieldsList = Object.keys(correctionData).join(', ');
            
            // Apply normalization
            const finalPatch = normalizeCanonPatch({ 
              patch, 
              current, 
              userRequest, 
              discussion: discussion || userRequest 
            });

             const charName = getCharacterName(characters[charIndex]) || 'character';
             const characterNames = (characters as any[]).map(c => getCharacterName(c));
             const proposal = {
               kind: 'asset_patch' as const,
               assetId: canon.id,
               baseAssetVersionId: canon.current_asset_version_id ?? null,
               summary: `Update ${charName} in ${canon.title || 'Canon Document'}`,
               patch: finalPatch,
               metadata: {
                 applyStrategy: 'canon_update',
                 canonAssetId: canon.id,
                 characterNames,
               },
             };
             
             return {
               success: true,
               message: `Understood—I've adjusted ${charName}'s ${fieldsList} in the document "${canon.title || 'Canon'}". Type /review to preview, then /apply to save.`,
               proposal,
               data: { canonAssetId: canon.id, patch: finalPatch, intentMode },
             };
          }
        }
        // If correction mode was detected but no valid data extracted, signal it to draft mode
        // by including correction context in the userRequest for the LLM
      }

      // Draft mode: keep chat smooth (no strict schema). We only compile a patch on /review or /apply.
      if (!isCompile) {
        const current = canonContent(canon);
        const characters = (current as any)?.characters || [];
        const charIndex = resolveTargetCharacterIndex(characters, userRequest);
        const targetChar = characters[charIndex] || null;
        const charName = targetChar ? (getCharacterName(targetChar) || 'character') : 'character';
        const currentCharData = targetChar && typeof targetChar === 'object' ? JSON.stringify(targetChar, null, 2).slice(0, 1400) : '';

        // If the user asks to update specific appearance fields, respond only with those fields.
        const requestedKeys = detectRequestedAppearanceKeys(userRequest);
        const isSuggestion = /\b(suggest|recommend|how|why|ideas|what)\b/i.test(userRequest);
        const wantsSpecificFields =
          requestedKeys.length > 0 &&
          !isSuggestion &&
          (/\b(fill|provide|update|set|change)\b/i.test(userRequest) ||
            /\b(only|just|just these|only these)\b/i.test(userRequest) ||
            /\bappearance\b/i.test(userRequest));

        const chatPrompt = [
          'You are an in-app Copilot helping the user edit their STORY CANON.',
          '',
          'Goals:',
          '- Discuss changes conversationally.',
          wantsSpecificFields
            ? `- The user asked to update specific fields for ${charName}: ${requestedKeys.join(', ')}.`
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
          currentCharData ? `\nCURRENT_CHARACTER_DETAILS:\n${currentCharData}\n` : '',
          `USER_REQUEST:\n${userRequest}\n`,
          discussion ? `DISCUSSION_CONTEXT:\n${discussion.slice(0, 1800)}\n` : '',
          'Assistant:',
        ]
          .filter(Boolean)
          .join('\n');

        const model =
          (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
          'gemma4:e2b';
        const llmRes = await executeTool('llmGenerateText', context, { model, prompt: chatPrompt, stream: false });
        const assistantReplyRaw = llmRes.ok ? String((llmRes.data as any)?.text ?? '').trim() : '';
        const assistantReply = wantsSpecificFields
          ? (() => {
              const parsedFromUser = extractAppearanceKeyValues(userRequest);
              const parsedFromAssistant = extractAppearanceKeyValues(assistantReplyRaw);
              const fallbackText = isSuggestion ? '' : buildAppearanceFallbackLines({ requestedKeys, character: targetChar, discussionText: discussion });
              const fallback = extractAppearanceKeyValues(fallbackText);
              
              const lines = requestedKeys
                .map(k => {
                  // Priority: User > Assistant > Fallback
                  const v = parsedFromUser[k] || parsedFromAssistant[k] || fallback[k] || '';
                  return isMeaningfulFieldValue(v) ? `${k}: ${v}` : '';
                })
                .filter(Boolean);
              
              if (lines.length > 0) {
                return lines.join('\n');
              }
              return assistantReplyRaw;
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
      const characters = (current as any)?.characters || [];

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
        const charIndex = resolveTargetCharacterIndex(characters, discussion || userRequest);
        const targetChar = charIndex !== null && Array.isArray(characters) ? (characters as any[])[charIndex] : null;
        const suggested = extractAppearanceKeyValues(discussion || '');
        const override = extractAppearanceKeyValues(userRequest);
        const fallbackText = buildAppearanceFallbackLines({ requestedKeys, character: targetChar, discussionText: discussion });
        const fallback = extractAppearanceKeyValues(fallbackText);
        const picked: Partial<Record<keyof CanonCharacterAppearance, string>> = {};
        for (const k of requestedKeys) {
          // Priority: User Request Override > Suggested in Discussion > Fallback
          const v = override[k] || suggested[k] || fallback[k];
          if (typeof v === 'string' && isMeaningfulFieldValue(v)) picked[k] = v;
        }

        if (charIndex !== null && Object.keys(picked).length > 0) {
          const patch: JsonPatchOperation[] = [];
          const existingAppearance =
            targetChar && typeof targetChar === 'object' && (targetChar as any).appearance && typeof (targetChar as any).appearance === 'object' && !Array.isArray((targetChar as any).appearance)
              ? (targetChar as any).appearance
              : null;
          if (!existingAppearance) {
            patch.push({ op: 'add', path: `/characters/${charIndex}/appearance`, value: {} });
          }
          for (const [k, v] of Object.entries(picked)) {
            // Use "add" so it works whether the field exists yet or not.
            patch.push({ op: 'add', path: `/characters/${charIndex}/appearance/${k}`, value: v });
          }

          const finalPatch = normalizeCanonPatch({ 
            patch, 
            current, 
            userRequest: '/review', 
            discussion: (discussion || '') + '\n' + userRequest 
          });

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
          const charName = getCharacterName(characters[charIndex]) || 'character';
          return {
            success: true,
            message: `Drafted canon updates for ${charName} (${requestedKeys.join(', ')}). Type /review to preview the proposal, then /apply to save it.`,
            proposal,
            data: { canonAssetId: canon.id, patch: finalPatch },
          };
        }
      }

      // Fast-path: if the user explicitly wants to update a single character,
      // avoid patching the wrong character by generating a deterministic patch.
      const target = explicitlyTargetsSingleCharacter(userRequest, characters);
      if (target) {
        const sourceText = discussion?.trim() ? discussion : userRequest;
        const deterministic = buildDeterministicCharacterPatch({ current, discussion: sourceText });
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
          const charIndex = resolveTargetCharacterIndex(characters, discussion || userRequest);
          const charName = charIndex !== null ? (getCharacterName(characters[charIndex]) || 'character') : 'character';
          return {
            success: true,
            message:
              `Drafted canon updates for ${charName}. Type /review to preview the proposal, then /apply to save it as a new canon version.`,
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
        'gemma4:e2b';

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
          'gemma4:e2b';
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
          'gemma4:e2b';
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
      const singleTarget = explicitlyTargetsSingleCharacter(userRequest, characters);
      if (singleTarget) {
        // If the model didn't produce a patch targeting the intended character, prefer deterministic patch.
        const touchesTarget = finalPatch.some(op => String((op as any)?.path ?? '').includes(`/characters/${singleTarget.index}`));
        if (!finalPatch.length || !touchesTarget) {
          const deterministic = buildDeterministicCharacterPatch({ current, discussion });
          if (deterministic) finalPatch = deterministic;
        }
      } else if (looksLikeUserOnlyMentionsSingleCharacter(userRequest, characters)) {
        if (!finalPatch.length) {
          const deterministic = buildDeterministicCharacterPatch({ current, discussion });
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
