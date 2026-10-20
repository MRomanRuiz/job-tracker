import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from './mockApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mockApi', () => {
  it('returns a not-found response for an unconfigured route', async () => {
    const fetchMock = mockApi({});
    const response = await fetchMock('/api/missing');

    expect(response.status).toBe(404);
    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toEqual({
      error: 'Not found',
    });
  });
});
