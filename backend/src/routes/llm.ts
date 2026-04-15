import { FastifyInstance } from 'fastify';
import { config } from '../config.js';

interface LLMGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
}

interface LLMGenerateResponse {
  response: string;
}

export async function registerLLMRoutes(app: FastifyInstance) {
  app.post<{ Body: LLMGenerateRequest }>('/llm/generate', async (request, reply) => {
    const { model, prompt, stream = false } = request.body;

    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

    const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || config.defaults.llm_model,
        prompt,
        stream,
      }),
    });

    if (!ollamaResponse.ok) {
      const error = await ollamaResponse.text();
      reply.code(500);
      return { error: 'LLM generation failed', details: error };
    }

    const data = (await ollamaResponse.json()) as LLMGenerateResponse;
    return data;
  });
}
