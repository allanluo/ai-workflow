import { listProjectEvents, insertProjectEvent } from "@ai-workflow/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PassThrough } from "stream";

const projectIdParamsSchema = z.object({ projectId: z.string() });

export async function registerEventRoutes(app: FastifyInstance) {
  app.get("/projects/:projectId/events", async (request) => {
    const params = projectIdParamsSchema.parse(request.params);

    return {
      ok: true,
      data: {
        projectId: params.projectId,
        items: listProjectEvents(params.projectId),
        nextCursor: null
      },
      error: null
    };
  });

  app.post("/projects/:projectId/events", async (request) => {
    const params = projectIdParamsSchema.parse(request.params);
    const body = z.object({
      event_type: z.string(),
      target_type: z.string().optional(),
      target_id: z.string().optional(),
      payload: z.record(z.unknown()).optional(),
    }).parse(request.body);

    insertProjectEvent(params.projectId, body.event_type, {
      target_type: body.target_type,
      target_id: body.target_id,
      ...body.payload,
    });

    return { ok: true, data: null, error: null };
  });

  app.get("/projects/:projectId/events/stream", (request, reply) => {
    const params = projectIdParamsSchema.parse(request.params);
    const seenEventIds = new Set(listProjectEvents(params.projectId).map((event) => event.id));

    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache, no-transform");
    reply.header("Connection", "keep-alive");
    reply.header("X-Accel-Buffering", "no");

    const stream = new PassThrough();

    const payload = JSON.stringify({
      event_type: "stream_connected",
      project_id: params.projectId,
      timestamp: new Date().toISOString(),
      data: {}
    });

    stream.write(`event: ready\n`);
    stream.write(`data: ${payload}\n\n`);

    const poll = setInterval(() => {
      const freshEvents = listProjectEvents(params.projectId)
        .filter((event) => !seenEventIds.has(event.id))
        .reverse();

      for (const event of freshEvents) {
        seenEventIds.add(event.id);
        stream.write(`event: project_event\n`);
        stream.write(`id: ${event.id}\n`);
        stream.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }, 1000);

    const heartbeat = setInterval(() => {
      stream.write(`event: heartbeat\n`);
      stream.write(`data: {"timestamp":"${new Date().toISOString()}"}\n\n`);
    }, 15000);

    request.raw.on("close", () => {
      clearInterval(poll);
      clearInterval(heartbeat);
      stream.end();
    });

    return reply.send(stream);
  });
}
