import { z } from 'zod';
import { getTool } from './registry';
import type { ToolContext, ToolInvocationResult } from './types';
import { appendAuditEvent, summarizeDetails } from '../auditLog';

export async function executeTool(
  toolName: string,
  context: ToolContext,
  params: unknown
): Promise<ToolInvocationResult<unknown>> {
  const projectId = (context as any)?.projectId as string | undefined;
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  appendAuditEvent(projectId || '', {
    type: 'tool_call',
    tool: toolName,
    summary: `Tool call: ${toolName}`,
    details: summarizeDetails(params),
  });

  const tool = getTool(toolName);
  if (!tool) {
    appendAuditEvent(projectId || '', {
      type: 'tool_result',
      tool: toolName,
      ok: false,
      duration_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
      summary: `Unknown tool: ${toolName}`,
    });
    return { ok: false, error: { message: `Unknown tool: ${toolName}` } };
  }

  const parsedParams = tool.paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    appendAuditEvent(projectId || '', {
      type: 'tool_result',
      tool: toolName,
      ok: false,
      duration_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
      summary: `Invalid params: ${toolName}`,
      details: summarizeDetails(parsedParams.error.format()),
    });
    return {
      ok: false,
      error: { message: `Invalid params for tool: ${toolName}`, details: parsedParams.error.format() },
    };
  }

  try {
    const raw = await tool.execute(context, parsedParams.data);
    const parsedResult = tool.resultSchema.safeParse(raw);
    if (!parsedResult.success) {
      appendAuditEvent(projectId || '', {
        type: 'tool_result',
        tool: toolName,
        ok: false,
        duration_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
        summary: `Invalid tool result: ${toolName}`,
        details: summarizeDetails(parsedResult.error.format()),
      });
      return {
        ok: false,
        error: {
          message: `Invalid result from tool: ${toolName}`,
          details: parsedResult.error.format(),
        },
      };
    }
    appendAuditEvent(projectId || '', {
      type: 'tool_result',
      tool: toolName,
      ok: true,
      duration_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
      summary: `Tool ok: ${toolName}`,
    });
    return { ok: true, data: parsedResult.data };
  } catch (err) {
    appendAuditEvent(projectId || '', {
      type: 'tool_result',
      tool: toolName,
      ok: false,
      duration_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
      summary: `Tool failed: ${toolName}`,
      details: summarizeDetails(err),
    });
    return {
      ok: false,
      error: {
        message: err instanceof Error ? err.message : `Tool failed: ${toolName}`,
        details: err,
      },
    };
  }
}

export const UnknownSchema = z.unknown();
