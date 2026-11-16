import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/apiRequest';
import { replaceById } from '../lib/utils';

export default function useCollection(name) {
  const [items, setItems] = useState([]);
  const [staleItems, setStaleItems] = useState([]);
  const latestStaleRequest = useRef(0);

  const request = useCallback(
    async (path = '', options = {}, { throwErrors = false } = {}) => {
      const url = `/${name}${path}`;

      try {
        return await apiRequest(url, options);
      } catch (error) {
        console.info(`Error en ${options.method ?? 'GET'} /api${url}:`, error);

        if (throwErrors) {
          throw error;
        }

        return null;
      }
    },
    [name],
  );

  // Ignores responses from older requests so the alert never goes back in time.
  const loadStale = useCallback(async () => {
    latestStaleRequest.current += 1;
    const requestId = latestStaleRequest.current;
    const data = await request('/old');

    if (data && requestId === latestStaleRequest.current) {
      setStaleItems(data[name]);
    }
  }, [name, request]);

  useEffect(() => {
    void request().then(data => {
      if (data) {
        setItems(data[name]);
      }
    });

    void loadStale();
  }, [name, request, loadStale]);

  const replace = async (path, body, { throwErrors = false } = {}) => {
    const updated = await request(path, { method: 'PATCH', body }, { throwErrors });

    if (!updated) {
      return false;
    }

    setItems(current => replaceById(current, updated));

    return updated;
  };

  const create = async values => {
    const created = await request('', { method: 'POST', body: values });

    if (!created) {
      return false;
    }

    setItems(current => [...current, created]);
    void loadStale();

    return true;
  };

  const update = async (id, changes) => {
    const updated = await replace(`/${id}`, changes, { throwErrors: true });

    if (updated && changes.status !== undefined) {
      void loadStale();
    }

    return updated;
  };

  const suspend = async id => {
    if (await replace(`/${id}/suspend`)) {
      void loadStale();
    }
  };

  const remove = async id => {
    const deleted = await request(`/${id}`, { method: 'DELETE' });

    if (!deleted) {
      return false;
    }

    setItems(current => current.filter(item => item.id !== Number(id)));
    void loadStale();

    return true;
  };

  return { items, staleItems, create, update, suspend, remove };
}
