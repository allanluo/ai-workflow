import { ExecutionPlanSchema, type ExecutionPlan } from './planSchema';
import { buildPlannerSystemPrompt } from './plannerPrompt';
import { extractFirstJsonObject } from '../llmClient';
import { executeTool, listTools, type ToolContext } from '../tools';

function buildPlannerRepairPrompt(input: {
  systemPrompt: string;
  toolList: string;
  context: string;
  userText: string;
  invalidOutput: string;
  error?: string;
}) {
  return [
    input.systemPrompt,
    '',
    input.error ? `PARSE_ERROR: ${input.error}` : '',
    '',
    'You previously returned invalid or non-conforming JSON.',
    'Return ONLY a valid JSON object that matches the schema and rules above.',
    'Do not include any commentary, markdown, or code fences.',
    '',
    'TOOL_LIST:',
    input.toolList || '(none)',
    '',
    'CONTEXT:',
    input.context,
    '',
    'USER_REQUEST:',
    input.userText,
    '',
    'INVALID_OUTPUT:',
    input.invalidOutput,
    '',
    'JSON:',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function createExecutionPlan(input: {
  userText: string;
  context: string;
  toolContext: ToolContext;
}): Promise<{ ok: true; plan: ExecutionPlan } | { ok: false; error: string; raw?: string }> {
  const model = (import.meta.env.VITE_COPILOT_PLANNER_MODEL as string | undefined) ||
    (import.meta.env.VITE_COPILOT_MODEL as string | undefined) ||
    'gemma3:1b';

  const tools = listTools();
  const toolList = tools
    .map(t => `- ${t.name} (${t.category}): ${t.description}`)
    .join('\n')
    .trim();

  const systemPrompt = buildPlannerSystemPrompt();
  const prompt = [
    systemPrompt,
    '',
    'TOOL_LIST:',
    toolList || '(none)',
    '',
    'CONTEXT:',
    input.context,
    '',
    'USER_REQUEST:',
    input.userText,
    '',
    'JSON:',
  ].join('\n');

  try {
    const res = await executeTool('llmGenerateText', input.toolContext, { model, prompt, stream: false });
    if (!res.ok) return { ok: false, error: res.error.message };
    const raw = String((res.data as any)?.text ?? '');

    const tryParseAndValidate = (text: string) => {
      const parsed = extractFirstJsonObject(text);
      return ExecutionPlanSchema.safeParse(parsed);
    };

    let validated: ReturnType<typeof ExecutionPlanSchema.safeParse>;
    try {
      validated = tryParseAndValidate(raw);
    } catch (err) {
      const repairPrompt = buildPlannerRepairPrompt({
        systemPrompt,
        toolList,
        context: input.context,
        userText: input.userText,
        invalidOutput: raw.slice(0, 8000),
        error: err instanceof Error ? err.message : String(err),
      });
      const repair = await executeTool('llmGenerateText', input.toolContext, { model, prompt: repairPrompt, stream: false });
      if (!repair.ok) return { ok: false, error: 'Planner returned invalid JSON plan.', raw };
      const repairedRaw = String((repair.data as any)?.text ?? '');
      try {
        validated = tryParseAndValidate(repairedRaw);
        if (!validated.success) return { ok: false, error: 'Planner returned invalid JSON plan.', raw: repairedRaw };
        return { ok: true, plan: validated.data };
      } catch {
        return { ok: false, error: 'Planner returned invalid JSON plan.', raw };
      }
    }

    if (!validated.success) {
      // One more best-effort repair if the JSON parses but doesn't match schema.
      const repairPrompt = buildPlannerRepairPrompt({
        systemPrompt,
        toolList,
        context: input.context,
        userText: input.userText,
        invalidOutput: raw.slice(0, 8000),
        error: 'Schema validation failed',
      });
      const repair = await executeTool('llmGenerateText', input.toolContext, { model, prompt: repairPrompt, stream: false });
      if (!repair.ok) return { ok: false, error: 'Planner returned invalid JSON plan.', raw };
      const repairedRaw = String((repair.data as any)?.text ?? '');
      try {
        const repairedValidated = tryParseAndValidate(repairedRaw);
        if (!repairedValidated.success) return { ok: false, error: 'Planner returned invalid JSON plan.', raw: repairedRaw };
        return { ok: true, plan: repairedValidated.data };
      } catch {
        return { ok: false, error: 'Planner returned invalid JSON plan.', raw };
      }
    }
    return { ok: true, plan: validated.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Planner failed' };
  }
}
