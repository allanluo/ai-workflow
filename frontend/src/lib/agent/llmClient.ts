type LLMGenerateResponse = {
  model?: string;
  response?: string;
};

export async function llmGenerateText(input: {
  prompt: string;
  model?: string;
  stream?: boolean;
}): Promise<string> {
  const response = await fetch('/api/llm/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model ?? 'gemma3:1b',
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
  let escape = false;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
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

