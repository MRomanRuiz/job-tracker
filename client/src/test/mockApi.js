import { vi } from 'vitest';

// Routes are keyed by "METHOD /api/path"; a handler returns the JSON body or
// { httpStatus, body } for other responses, optionally asynchronously.
export const mockApi = routes => {
  const fetchMock = vi.fn(async (url, { method = 'GET', body } = {}) => {
    const handler = routes[`${method} ${url}`];
    const result =
      typeof handler === 'function'
        ? await handler(body && JSON.parse(body))
        : handler;
    const { httpStatus = 200, body: data } =
      result?.httpStatus === undefined ? { body: result } : result;
    const status = handler === undefined ? 404 : httpStatus;

    return {
      ok: status < 400,
      status,
      json: async () => data ?? { error: 'Not found' },
    };
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
};
