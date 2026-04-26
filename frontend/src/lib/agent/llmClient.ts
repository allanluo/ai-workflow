import { API_BASE_URL } from '../api';

type LLMGenerateResponse = {
  model?: string;
  response?: string;
};

export async function llmGenerateText(input: {
  prompt: string;
  model?: string;
  stream?: boolean;
}): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/llm/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model ?? 'gemma4:e2b',
      prompt: input.prompt,
      stream: input.stream ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with ${response.status}`);
  }

  const data = (await response.json()) as LLMGenerateResponse;
  const text = typeof data.response === 'string' ? data.response : '';
  return text;
}

export function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in model response.');

  let inString = false;
  let stringChar: '"' | "'" | null = null;
  let escape = false;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (stringChar && ch === stringChar) {
        inString = false;
        stringChar = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch as '"' | "'";
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        return JSON.parse(slice) as unknown;
      }
      continue;
    }
  }

  throw new Error('Incomplete JSON object in model response.');
}

function stripCodeFences(text: string) {
  const t = (text || '').trim();
  if (!t) return '';
  // Remove ```json ... ``` and ``` ... ``` wrappers.
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function removeJsonComments(text: string) {
  // Best-effort only; this is NOT a complete comment parser.
  return (text || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function removeTrailingCommas(text: string) {
  return (text || '').replace(/,\s*([}\]])/g, '$1');
}

function removeOptionalMarkersInKeys(text: string) {
  // Turn `questions?:` or `"questions"?:` into `questions:` / `"questions":`
  // Also remove stray `?` tokens that might appear after field names before colons
  let result = (text || '')
    .replace(/"([^"]+)"\s*\?\s*:/g, (_, k) => `"${k}":`)
    .replace(/([A-Za-z_][A-Za-z0-9_]*)\s*\?\s*:/g, (_, k) => `${k}:`);
  
  // Clean up any remaining stray `?` that isn't inside strings (likely parse artifacts)
  // This handles cases like: { field?: value } -> { field: value }
  result = result.replace(/\?\s*([,}\]])/g, '$1');
  
  return result;
}

function quoteUnquotedKeys(text: string) {
  // Quote object keys like: { foo: 1, bar_baz: "x" } -> { "foo": 1, "bar_baz": "x" }
  // Avoid touching already-quoted keys.
  return (text || '').replace(/([{\s,])([A-Za-z_][A-Za-z0-9_]*)\s*:/g, (m, pre, key) => {
    if (pre === '"' || pre === "'") return m;
    return `${pre}"${key}":`;
  });
}

function replaceSmartQuotes(text: string) {
  return (text || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function tryCoerceSingleQuotedJson(text: string) {
  const raw = text || '';
  const singleQuotes = (raw.match(/'/g) || []).length;
  const doubleQuotes = (raw.match(/"/g) || []).length;
  if (singleQuotes < 8) return raw;
  if (doubleQuotes > singleQuotes / 3) return raw;

  // Convert common JSON-ish patterns:
  // - 'key': -> "key":
  // - : 'value' -> : "value"
  // This won't handle every edge case but helps for many LLM outputs.
  let out = raw.replace(/'([^'\\\n\r]+)'\s*:/g, (_, k) => `"${String(k).replace(/"/g, '\\"')}":`);
  out = out.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, v) => {
    const inner = String(v).replace(/"/g, '\\"');
    return `: "${inner}"`;
  });
  return out;
}

export function extractFirstJsonObjectLenient(text: string): unknown {
  const cleaned = stripCodeFences(text);
  try {
    return extractFirstJsonObject(cleaned);
  } catch {
    // fall through
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('No JSON object found in model response.');
  }

  const slice = cleaned.slice(start, end + 1);
  const normalized = tryCoerceSingleQuotedJson(
    quoteUnquotedKeys(
      removeOptionalMarkersInKeys(
        removeTrailingCommas(removeJsonComments(replaceSmartQuotes(slice)))
      )
    )
  );

  try {
    return JSON.parse(normalized) as unknown;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Invalid JSON');
  }
}
