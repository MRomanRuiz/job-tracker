import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api';
import { replaceById } from '../utils';

export default function useCollection(name) {
  const [items, setItems] = useState([]);
  const [staleItems, setStaleItems] = useState([]);
  const latestStaleRequest = useRef(0);

  const request = useCallback(
    async (path = '', options = {}) => {
      const url = `/${name}${path}`;

      try {
        return await apiRequest(url, options);
      } catch (error) {
        console.error(`Error en ${options.method ?? 'GET'} /api${url}:`, error);
        return null;
      }
    },
    [name],
  );

  // Ignores responses from older requests so the alert never goes back in time.
  const loadStale = useCallback(async () => {
    const requestId = ++latestStaleRequest.current;
    const data = await request('/old');

    if (data && requestId === latestStaleRequest.current) {
      setStaleItems(data[name]);
    }
  }, [name, request]);

  useEffect(() => {
    request().then(data => {
      if (data) {
        setItems(data[name]);
      }
    });

    loadStale();
  }, [name, request, loadStale]);

  const replace = async (path, body) => {
    const updated = await request(path, { method: 'PATCH', body });

    if (!updated) {
      return false;
    }

    setItems(current => replaceById(current, updated));

    return true;
  };

  const create = async values => {
    const created = await request('', { method: 'POST', body: values });

    if (!created) {
      return false;
    }

    setItems(current => [...current, created]);
    loadStale();

    return true;
  };

  const update = async (id, changes) => {
    const updated = await replace(`/${id}`, changes);

    if (updated && changes.status !== undefined) {
      loadStale();
    }

    return updated;
  };

  const suspend = async id => {
    if (await replace(`/${id}/suspend`)) {
      loadStale();
    }
  };

  return { items, staleItems, create, update, suspend };
}
