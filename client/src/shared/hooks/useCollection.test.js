import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../test/helpers/mockApi';
import useCollection from './useCollection';

const pending = { id: 1, contact: 'Ana', status: 'pending' };

const renderCollection = routes => {
  const fetchMock = mockApi({
    'GET /api/contacts': { contacts: [pending] },
    'GET /api/contacts/old': { contacts: [pending] },
    ...routes,
  });
  const hook = renderHook(() => useCollection('contacts'));

  return { fetchMock, ...hook };
};

const staleRequests = fetchMock =>
  fetchMock.mock.calls.filter(([url]) => url === '/api/contacts/old').length;

describe('useCollection', () => {
  it('loads the items and the stale items on mount', async () => {
    const { result } = renderCollection();

    await waitFor(() => expect(result.current.items).toEqual([pending]));
    await waitFor(() => expect(result.current.staleItems).toEqual([pending]));
  });

  it('appends created items and reloads the stale items', async () => {
    const created = { id: 2, contact: 'Eva', status: 'pending' };
    const { result, fetchMock } = renderCollection({
      'POST /api/contacts': body => ({
        httpStatus: 201,
        body: { id: 2, ...body },
      }),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    let ok;
    await act(async () => {
      ok = await result.current.create({ contact: 'Eva', status: 'pending' });
    });

    expect(ok).toBe(true);
    expect(result.current.items).toEqual([pending, created]);
    expect(staleRequests(fetchMock)).toBe(2);
  });

  it('reloads the stale items only when the status changes', async () => {
    const updated = { ...pending, status: 'replied' };
    const { result, fetchMock } = renderCollection({
      'PATCH /api/contacts/1': body => ({ ...pending, ...body, updatedAt: '2026-02-01' }),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(() => result.current.update(1, { notes: 'Llamar' }));
    expect(result.current.items[0].notes).toBe('Llamar');
    expect(staleRequests(fetchMock)).toBe(1);

    let response;
    await act(async () => {
      response = await result.current.update(1, { status: 'replied' });
    });
    expect(result.current.items[0].status).toBe('replied');
    expect(staleRequests(fetchMock)).toBe(2);
    expect(response).toEqual({ ...updated, updatedAt: '2026-02-01' });
  });

  it('suspends an item and reloads the stale items', async () => {
    let stale = [pending];
    const { result } = renderCollection({
      'GET /api/contacts/old': () => ({ contacts: stale }),
      'PATCH /api/contacts/1/suspend': () => {
        stale = [];
        return { ...pending, status: 'suspended' };
      },
    });

    await waitFor(() => expect(result.current.staleItems).toHaveLength(1));

    await act(() => result.current.suspend(1));

    expect(result.current.items[0].status).toBe('suspended');
    await waitFor(() => expect(result.current.staleItems).toEqual([]));
  });

  it('does not reload stale items when suspending fails', async () => {
    const { result, fetchMock } = renderCollection({
      'PATCH /api/contacts/1/suspend': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => expect(result.current.staleItems).toEqual([pending]));

    await act(() => result.current.suspend(1));

    expect(result.current.items).toEqual([pending]);
    expect(staleRequests(fetchMock)).toBe(1);
  });

  it('propagates detailed update errors and keeps the current items', async () => {
    const consoleError = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result } = renderCollection({
      'PATCH /api/contacts/1': {
        httpStatus: 400,
        body: {
          message: 'Invalid contact data',
          details: [{ field: 'email', message: 'Must be a string' }],
        },
      },
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await expect(result.current.update(1, { status: 'replied' })).rejects.toThrow(
        'email: Must be a string',
      );
    });

    expect(result.current.items).toEqual([pending]);
    expect(consoleError).toHaveBeenCalledWith(
      'Error en PATCH /api/contacts/1:',
      expect.objectContaining({ message: 'email: Must be a string' }),
    );
  });

  it('returns false when creating an item fails', async () => {
    const { result } = renderCollection({
      'POST /api/contacts': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => expect(result.current.items).toEqual([pending]));

    let created;
    await act(async () => {
      created = await result.current.create({ contact: 'Eva' });
    });

    expect(created).toBe(false);
    expect(result.current.items).toEqual([pending]);
  });

  it('uses GET when logging failed default requests', async () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result } = renderCollection({
      'GET /api/contacts': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() =>
      expect(consoleInfo).toHaveBeenCalledWith(
        'Error en GET /api/contacts:',
        expect.objectContaining({ message: 'Unavailable' }),
      ),
    );
    expect(result.current.items).toEqual([]);
  });

  it('ignores stale responses that arrive after a newer one', async () => {
    let resolveFirst;
    let staleCalls = 0;
    const { result } = renderCollection({
      'GET /api/contacts/old': () => {
        staleCalls += 1;

        return staleCalls === 1
          ? new Promise(resolve => {
              resolveFirst = resolve;
            })
          : { contacts: [] };
      },
      'PATCH /api/contacts/1/suspend': { ...pending, status: 'suspended' },
    });

    await waitFor(() => expect(resolveFirst).toBeDefined());
    await act(() => result.current.suspend(1));
    await act(async () => resolveFirst({ contacts: [pending] }));

    expect(result.current.staleItems).toEqual([]);
  });

  it('removes an item and reloads the stale items', async () => {
    let stale = [pending];

    const { result, fetchMock } = renderCollection({
      'GET /api/contacts/old': () => ({ contacts: stale }),
      'DELETE /api/contacts/1': () => {
        stale = [];
        return { httpStatus: 204 };
      },
    });

    await waitFor(() => expect(result.current.items).toEqual([pending]));
    await waitFor(() => expect(result.current.staleItems).toEqual([pending]));

    let deleted;
    await act(async () => {
      deleted = await result.current.remove(1);
    });

    expect(deleted).toBe(true);
    expect(result.current.items).toEqual([]);

    await waitFor(() => expect(result.current.staleItems).toEqual([]));

    expect(staleRequests(fetchMock)).toBe(2);
  });

  it('keeps the item and does not reload stale items when deletion fails', async () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { result, fetchMock } = renderCollection({
      'DELETE /api/contacts/1': {
        httpStatus: 500,
        body: { error: 'Unavailable' },
      },
    });

    await waitFor(() => expect(result.current.items).toEqual([pending]));

    let deleted;
    await act(async () => {
      deleted = await result.current.remove(1);
    });

    expect(deleted).toBe(false);
    expect(result.current.items).toEqual([pending]);
    expect(staleRequests(fetchMock)).toBe(1);

    expect(consoleInfo).toHaveBeenCalledWith(
      'Error en DELETE /api/contacts/1:',
      expect.objectContaining({ message: 'Unavailable' }),
    );
  });
});
