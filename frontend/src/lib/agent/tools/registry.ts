import type { ToolDefinition } from './types';

const toolRegistry = new Map<string, ToolDefinition<any, any>>();

export function registerTool<Params, Output>(tool: ToolDefinition<Params, Output>) {
  toolRegistry.set(tool.name, tool as ToolDefinition<any, any>);
}

export function getTool(name: string) {
  return toolRegistry.get(name) ?? null;
}

export function listTools() {
  return [...toolRegistry.values()]
    .filter(t => t.exposedToPlanner !== false)
    .map(t => ({
      name: t.name,
      category: t.category,
      description: t.description,
    }));
}
