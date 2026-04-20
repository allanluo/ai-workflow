import type { ServerResponse } from 'node:http';
import type { RunUpdateEvent, StepUpdateEvent } from './planRunner.js';

type AnyEvent = RunUpdateEvent | StepUpdateEvent;

const streamsByRunId = new Map<string, Set<ServerResponse>>();

function writeEvent(res: ServerResponse, event: AnyEvent) {
  try {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // ignore broken pipes
  }
}

export function addRunStream(runId: string, res: ServerResponse) {
  const set = streamsByRunId.get(runId) ?? new Set<ServerResponse>();
  set.add(res);
  streamsByRunId.set(runId, set);
}

export function removeRunStream(runId: string, res: ServerResponse) {
  const set = streamsByRunId.get(runId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) streamsByRunId.delete(runId);
}

export function broadcastRunEvent(runId: string, event: AnyEvent) {
  const set = streamsByRunId.get(runId);
  if (!set) return;
  for (const res of [...set]) {
    if (res.writableEnded) {
      set.delete(res);
      continue;
    }
    writeEvent(res, event);
  }
}

