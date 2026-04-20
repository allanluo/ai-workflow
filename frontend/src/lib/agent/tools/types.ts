import type { z } from 'zod';
import type { SkillContext } from '../types';

export type ToolCategory = 'read' | 'write' | 'exec';

export type ToolContext = SkillContext & {
  // Reserved for future version pinning, auth scopes, etc.
};

export type ToolError = {
  message: string;
  details?: unknown;
};

export type ToolInvocationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ToolError };

export type ToolDefinition<Params, Output> = {
  name: string;
  description: string;
  category: ToolCategory;
  // If false, the tool will not be included in the planner's TOOL_LIST.
  // This is useful for internal/unsafe tools that should be invoked only via higher-level flows.
  exposedToPlanner?: boolean;
  paramsSchema: z.ZodType<Params>;
  resultSchema: z.ZodType<Output>;
  execute: (context: ToolContext, params: Params) => Promise<Output>;
};
