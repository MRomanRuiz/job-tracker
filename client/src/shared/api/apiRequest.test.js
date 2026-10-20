import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './apiRequest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('sends GET by default and returns the parsed response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ applications: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/applications')).resolves.toEqual({
      applications: [],
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/applications', {
      method: 'GET',
    });
  });

  it('serializes a request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/contacts', {
      method: 'POST',
      body: { contact: 'Ana' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: 'Ana' }),
    });
  });

  it('uses the server error or falls back to the HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid contact' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({}),
        }),
    );

    await expect(apiRequest('/contacts')).rejects.toThrow(
      'Invalid contact',
    );
    await expect(apiRequest('/contacts')).rejects.toThrow('Error 502');
  });

  it('continues when an error response has no JSON body', async () => {
    vi.stubGlobal('fetch', () => ({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('Not JSON')),
    }));

    await expect(apiRequest('/contacts')).rejects.toThrow('Error 503');
  });
});
