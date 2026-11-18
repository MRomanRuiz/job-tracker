import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './apiRequest';
import { LABELS } from '../lib/labels';

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

  it('returns true for a successful response with no content', async () => {
    const json = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json,
      }),
    );

    await expect(apiRequest('/contacts/1', { method: 'DELETE' })).resolves.toBe(true);
    expect(json).not.toHaveBeenCalled();
  });

  it('uses server validation details or falls back to the HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            message: 'Invalid contact',
            details: [
              { field: 'email', message: 'Must be a valid email address' },
              { field: 'contact', message: 'Contact name is required' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({}),
        }),
    );

    await expect(apiRequest('/contacts')).rejects.toThrow(
      'email: Must be a valid email address; contact: Contact name is required',
    );
    await expect(apiRequest('/contacts')).rejects.toThrow(
      LABELS.common.badGatewayError,
    );
  });

  it('uses the server message when no validation details are provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          message: 'Could not load contacts',
          error: 'Internal server error',
        }),
      }),
    );

    await expect(apiRequest('/contacts')).rejects.toThrow('Could not load contacts');
  });

  it('continues when an error response has no JSON body', async () => {
    vi.stubGlobal('fetch', () => ({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('Not JSON')),
    }));

    await expect(apiRequest('/contacts')).rejects.toThrow(
      LABELS.common.httpError.replace('{status}', '503'),
    );
  });
});
