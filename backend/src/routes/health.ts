import { getDatabaseStatus } from "@ai-workflow/database";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      ok: true,
      data: {
        name: config.appName,
        version: config.appVersion,
        timestamp: new Date().toISOString(),
        database: getDatabaseStatus()
      },
      error: null
    };
  });
}
