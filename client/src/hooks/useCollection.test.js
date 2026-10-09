import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockApi } from '../test/mockApi';
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
      'POST /api/contacts': body => ({ httpStatus: 201, body: { id: 2, ...body } }),
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
    const { result, fetchMock } = renderCollection({
      'PATCH /api/contacts/1': body => ({ ...pending, ...body }),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(() => result.current.update(1, { notes: 'Llamar' }));
    expect(result.current.items[0].notes).toBe('Llamar');
    expect(staleRequests(fetchMock)).toBe(1);

    await act(() => result.current.update(1, { status: 'replied' }));
    expect(result.current.items[0].status).toBe('replied');
    expect(staleRequests(fetchMock)).toBe(2);
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

  it('logs failed requests and keeps the current items', async () => {
    const consoleError = vi
      .spyOn(console, 'info')
      .mockImplementation(() => {});
    const { result } = renderCollection({
      'PATCH /api/contacts/1': { httpStatus: 400, body: { error: 'Inválido' } },
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));

    let ok;
    await act(async () => {
      ok = await result.current.update(1, { status: 'replied' });
    });

    expect(ok).toBe(false);
    expect(result.current.items).toEqual([pending]);
    expect(consoleError).toHaveBeenCalledWith(
      'Error en PATCH /api/contacts/1:',
      expect.objectContaining({ message: 'Inválido' }),
    );
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
});
