import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { embedTextWithFallback } from '../services/llmEmbeddings.js';
import { generateText } from '../services/adapters.js';

interface LLMGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

interface LLMGenerateResponse {
  response: string;
}

interface LLMEmbedRequest {
  model?: string;
  input: string;
}

export async function registerLLMRoutes(app: FastifyInstance) {
  app.post<{ Body: LLMGenerateRequest }>('/llm/generate', async (request, reply) => {
    const { model, prompt, stream = false } = request.body;
    try {
      const data = await generateText({
        model: model || config.defaults.llm_model,
        prompt,
        stream,
      });
      return data as LLMGenerateResponse;
    } catch (err) {
      reply.code(500);
      return { error: 'LLM generation failed', details: err instanceof Error ? err.message : String(err) };
    }
  });

  app.post<{ Body: LLMEmbedRequest }>('/llm/embed', async (request, reply) => {
    const { model, input } = request.body;
    if (!input || typeof input !== 'string') {
      reply.code(400);
      return { error: 'Missing input' };
    }
    const requestedModel = (model || process.env.DEFAULT_EMBEDDING_MODEL || '').trim() || undefined;

    try {
      const result = await embedTextWithFallback({
        text: input,
        model: requestedModel,
        allowFallback: !model,
      });
      return { model: result.model, dim: result.embedding.length, embedding: result.embedding };
    } catch (err) {
      reply.code(500);
      return { error: 'Embedding failed', details: err instanceof Error ? err.message : String(err) };
    }
  });
}
