import { initializeDatabase } from '@ai-workflow/database';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { registerEventRoutes } from './routes/events.js';
import { registerFileRoutes } from './routes/files.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerLLMRoutes } from './routes/llm.js';
import { registerAssetRoutes } from './routes/assets.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerWorkflowRoutes } from './routes/workflows.js';
import { registerReviewRoutes } from './routes/reviews.js';
import { registerLinkRoutes } from './routes/links.js';
import { registerCopilotRoutes } from './routes/copilot.js';
import { registerCopilotRunRoutes } from './routes/copilotRuns.js';

export async function buildApp() {
  initializeDatabase();

  const app = Fastify({
    logger: { level: 'warn' },
  });

  // Register Swagger for API documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: config.appName,
        description: 'Story-to-media production system API',
        version: config.appVersion,
      },
      servers: [
        {
          url: '/api/v1',
          description: 'API v1',
        },
      ],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/api/docs',
  });

  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
  });
  await app.register(multipart);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        ok: false,
        data: null,
        error: {
          code: 'bad_request',
          message: 'Request validation failed',
          details: error.flatten(),
        },
      });
      return;
    }

    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : null;
    const message =
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
        ? error.message
        : 'Request failed';

    if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
      reply.code(statusCode).send({
        ok: false,
        data: null,
        error: {
          code: 'bad_request',
          message,
        },
      });
      return;
    }

    request.log.error(error);

    reply.code(500).send({
      ok: false,
      data: null,
      error: {
        code: 'internal_error',
        message: 'An unexpected server error occurred',
      },
    });
  });

  await app.register(
    async api => {
      await api.register(registerHealthRoutes);
      await api.register(registerLLMRoutes);
      await api.register(registerEventRoutes);
      await api.register(registerProjectRoutes);
      await api.register(registerFileRoutes);
      await api.register(registerAssetRoutes);
      await api.register(registerWorkflowRoutes);
      await api.register(registerReviewRoutes);
      await api.register(registerLinkRoutes);
      await api.register(registerCopilotRoutes);
      await api.register(registerCopilotRunRoutes);
    },
    { prefix: '/api/v1' }
  );

  app.get('/', async () => ({
    ok: true,
    data: {
      name: config.appName,
      version: config.appVersion,
    },
    error: null,
  }));

  return app;
}
