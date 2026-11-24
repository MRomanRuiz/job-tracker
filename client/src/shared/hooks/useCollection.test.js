import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../test/helpers/mockApi';
import { LABELS } from '../lib/labels';
import useCollection from './useCollection';

const pending = { id: 1, contact: 'Ana', status: 'pending' };

const contactAlert = {
  entity: 'contact',
  recordId: 1,
  type: 'stale',
};

const renderCollection = (routes = {}) => {
  const fetchMock = mockApi({
    'GET /api/contacts': { contacts: [pending] },
    'GET /api/alerts': { alerts: [contactAlert] },
    ...routes,
  });

  const hook = renderHook(() => useCollection('contacts'));

  return { fetchMock, ...hook };
};

const staleRequests = fetchMock =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/alerts').length;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCollection', () => {
  it('loads the items and stale items from the alerts endpoint on mount', async () => {
    const { result } = renderCollection();

    await waitFor(() => {
      expect(result.current.items).toEqual([pending]);
      expect(result.current.staleItems).toEqual([pending]);
    });
  });

  it('filters alerts by entity and stale type', async () => {
    const applicationAlert = {
      entity: 'application',
      recordId: 1,
      type: 'stale',
    };

    const scheduledContactAlert = {
      entity: 'contact',
      recordId: 1,
      type: 'scheduled',
    };

    const { result } = renderCollection({
      'GET /api/alerts': {
        alerts: [applicationAlert, scheduledContactAlert, contactAlert],
      },
    });

    await waitFor(() => {
      expect(result.current.staleItems).toEqual([pending]);
    });
  });

  it('appends created items and reloads the alerts', async () => {
    const created = { id: 2, contact: 'Eva', status: 'pending' };

    const { result, fetchMock } = renderCollection({
      'POST /api/contacts': body => ({
        httpStatus: 201,
        body: { id: 2, ...body },
      }),
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    let ok;

    await act(async () => {
      ok = await result.current.create({
        contact: 'Eva',
        status: 'pending',
      });
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([pending, created]);
    expect(staleRequests(fetchMock)).toBe(2);
  });

  it('reloads alerts only when the status changes', async () => {
    const updated = { ...pending, status: 'in_conversation' };

    const { result, fetchMock } = renderCollection({
      'PATCH /api/contacts/1': body => ({
        ...pending,
        ...body,
        updatedAt: '2026-02-01',
      }),
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    await act(() => result.current.update(1, { notes: 'Llamar' }));

    expect(result.current.items[0].notes).toBe('Llamar');
    expect(staleRequests(fetchMock)).toBe(1);

    let response;

    await act(async () => {
      response = await result.current.update(1, {
        status: 'in_conversation',
      });
    });

    expect(result.current.items[0].status).toBe('in_conversation');
    expect(staleRequests(fetchMock)).toBe(2);
    expect(response).toEqual({
      ...updated,
      updatedAt: '2026-02-01',
    });
  });

  it('suspends an item and reloads its alerts', async () => {
    let stale = true;

    const { result } = renderCollection({
      'GET /api/alerts': () => ({
        alerts: stale ? [contactAlert] : [],
      }),
      'PATCH /api/contacts/1/suspend': () => {
        stale = false;
        return { ...pending, status: 'suspended' };
      },
    });

    await waitFor(() => {
      expect(result.current.staleItems).toEqual([pending]);
    });

    await act(() => result.current.suspend(1));

    expect(result.current.items[0].status).toBe('suspended');

    await waitFor(() => {
      expect(result.current.staleItems).toEqual([]);
    });
  });

  it('does not reload alerts when suspending fails', async () => {
    const { result, fetchMock } = renderCollection({
      'PATCH /api/contacts/1/suspend': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => {
      expect(result.current.staleItems).toEqual([pending]);
    });

    await act(() => result.current.suspend(1));

    expect(result.current.items).toEqual([pending]);
    expect(staleRequests(fetchMock)).toBe(1);
  });

  it('propagates detailed update errors and keeps the current items', async () => {
    const { result } = renderCollection({
      'PATCH /api/contacts/1': {
        httpStatus: 400,
        body: {
          message: 'Invalid contact data',
          details: [{ field: 'email', message: 'Must be a string' }],
        },
      },
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    await act(async () => {
      await expect(result.current.update(1, { status: 'in_conversation' })).rejects.toThrow(
        'email: Must be a string',
      );
    });

    expect(result.current.items).toEqual([pending]);
    expect(result.current.error).toBe('email: Must be a string');
  });

  it('returns false when creating an item fails', async () => {
    const { result } = renderCollection({
      'POST /api/contacts': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([pending]);
    });

    let created;

    await act(async () => {
      created = await result.current.create({ contact: 'Eva' });
    });

    expect(created).toBe(false);
    expect(result.current.items).toEqual([pending]);
    expect(result.current.error).toBe('Unavailable');
  });

  it('shows a server message when loading items fails', async () => {
    const { result } = renderCollection({
      'GET /api/contacts': {
        httpStatus: 500,
        body: { message: 'Database unavailable' },
      },
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Database unavailable');
    });

    expect(result.current.items).toEqual([]);
  });

  it('uses the generic message when a failed collection request has no message', async () => {
    const fetchMock = vi.fn(async url => {
      if (url === '/api/contacts') {
        throw new Error('');
      }

      return {
        status: 200,
        ok: true,
        json: async () => ({ alerts: [] }),
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCollection('contacts'));

    await waitFor(() => {
      expect(result.current.error).toBe(LABELS.common.requestError);
    });
  });

  it('keeps the item list empty when the initial response has no payload', async () => {
    const fetchMock = vi.fn(async url => ({
      status: 200,
      ok: true,
      json: async () => (url === '/api/contacts' ? null : { alerts: [] }),
    }));

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCollection('contacts'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe('');
  });

  it('ignores empty successful responses from alerts and mutation requests', async () => {
    const fetchMock = vi.fn(async (url, { method = 'GET' } = {}) => {
      const responses = {
        'GET /api/contacts': { contacts: [pending] },
        'GET /api/alerts': null,
        'POST /api/contacts': null,
        'PATCH /api/contacts/1': null,
        'DELETE /api/contacts/1': null,
      };

      return {
        status: 200,
        ok: true,
        json: async () => responses[`${method} ${url}`],
      };
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useCollection('contacts'));

    await waitFor(() => {
      expect(result.current.items).toEqual([pending]);
    });

    expect(result.current.staleItems).toEqual([]);

    await act(async () => {
      await expect(result.current.create({ contact: 'Eva' })).resolves.toBe(false);

      await expect(result.current.update(1, { notes: 'Follow up' })).resolves.toBe(false);

      await expect(result.current.remove(1)).resolves.toBe(false);
    });

    expect(result.current.items).toEqual([pending]);
    expect(result.current.error).toBe('');

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/alerts')).toHaveLength(1);
  });

  it('ignores stale alert responses that arrive after a newer response', async () => {
    let resolveFirst;
    let alertCalls = 0;

    const { result } = renderCollection({
      'GET /api/alerts': () => {
        alertCalls += 1;

        return alertCalls === 1
          ? new Promise(resolve => {
              resolveFirst = resolve;
            })
          : { alerts: [] };
      },
      'PATCH /api/contacts/1/suspend': {
        ...pending,
        status: 'suspended',
      },
    });

    await waitFor(() => {
      expect(resolveFirst).toBeDefined();
    });

    await act(() => result.current.suspend(1));

    await act(async () => {
      resolveFirst({ alerts: [contactAlert] });
    });

    expect(result.current.staleItems).toEqual([]);
  });

  it('removes an item and reloads its alerts', async () => {
    let stale = true;

    const { result, fetchMock } = renderCollection({
      'GET /api/alerts': () => ({
        alerts: stale ? [contactAlert] : [],
      }),
      'DELETE /api/contacts/1': () => {
        stale = false;
        return { httpStatus: 204 };
      },
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([pending]);
      expect(result.current.staleItems).toEqual([pending]);
    });

    let deleted;

    await act(async () => {
      deleted = await result.current.remove(1);
    });

    expect(deleted).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => {
      expect(result.current.staleItems).toEqual([]);
    });

    expect(staleRequests(fetchMock)).toBe(2);
  });

  it('keeps the item and does not reload alerts when deletion fails', async () => {
    const { result, fetchMock } = renderCollection({
      'DELETE /api/contacts/1': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => {
      expect(result.current.items).toEqual([pending]);
    });

    let deleted;

    await act(async () => {
      deleted = await result.current.remove(1);
    });

    expect(deleted).toBe(false);
    expect(result.current.items).toEqual([pending]);
    expect(staleRequests(fetchMock)).toBe(1);
    expect(result.current.error).toBe('Unavailable');
  });

  it('does not overwrite a collection error when loading alerts fails', async () => {
    const { result } = renderCollection({
      'GET /api/contacts': {
        httpStatus: 500,
        body: { message: 'Database unavailable' },
      },
      'GET /api/alerts': {
        httpStatus: 500,
        body: { message: 'Alerts unavailable' },
      },
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Database unavailable');
    });

    expect(result.current.items).toEqual([]);
  });
});
