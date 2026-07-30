import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { errorHandler } from '../../src/api/middleware/error-handler';

describe('health endpoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok status', async () => {
    const app = Fastify();
    app.setErrorHandler(errorHandler);
    app.get('/health', async () => ({
      status: 'ok',
      uptime: 1,
      timestamp: new Date().toISOString(),
    }));

    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });
});
