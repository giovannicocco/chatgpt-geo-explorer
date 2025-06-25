import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock the Earth Engine client library to avoid Node/browser differences during tests.
vi.mock('@google/earthengine', () => ({
  default: {
    data: {
      authenticateViaPrivateKey: (_key: unknown, success: () => void) => success(),
      getAuthToken: () => 'Bearer test-token'
    },
    initialize: (_a: unknown, _b: unknown, success: () => void) => success()
  }
}));

let worker: typeof import('../src/index').default;

beforeAll(async () => {
  (globalThis as any).window = {};
  const mod = await import('../src/index');
  worker = mod.default;
});

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('geo-explorer worker', () => {
  it('returns 405 for GET requests', async () => {
    const request = new IncomingRequest('http://example.com');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(405);
  });
});
