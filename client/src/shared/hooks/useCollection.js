import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/apiRequest';
import { LABELS } from '../lib/labels';
import { replaceById } from '../lib/utils';

export default function useCollection(name) {
  const [items, setItems] = useState([]);
  const [staleItems, setStaleItems] = useState([]);
  const [error, setError] = useState('');
  const latestStaleRequest = useRef(0);

  const reportError = useCallback(
    error => {
      setError(
        typeof error?.message === 'string' && error.message
          ? error.message
          : LABELS.common.requestError,
      );
    },
    [setError],
  );

  const request = useCallback(
    async (path = '', options = {}) => {
      const url = `/${name}${path}`;

      return apiRequest(url, options);
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
        setError('');
      }
    }).catch(reportError);

    void loadStale().catch(reportError);
  }, [name, request, loadStale, reportError]);

  const replace = async (path, body, { throwErrors = false } = {}) => {
    let updated;

    try {
      updated = await request(path, { method: 'PATCH', body });
    } catch (error) {
      reportError(error);

      if (throwErrors) {
        throw error;
      }

      return false;
    }

    if (!updated) {
      return false;
    }

    setError('');
    setItems(current => replaceById(current, updated));

    return updated;
  };

  const create = async values => {
    let created;

    try {
      created = await request('', { method: 'POST', body: values });
    } catch (error) {
      reportError(error);
      return false;
    }

    if (!created) {
      return false;
    }

    setError('');
    setItems(current => [...current, created]);
    void loadStale().catch(reportError);

    return true;
  };

  const update = async (id, changes) => {
    const updated = await replace(`/${id}`, changes, { throwErrors: true });

    if (updated && changes.status !== undefined) {
      void loadStale().catch(reportError);
    }

    return updated;
  };

  const suspend = async id => {
    if (await replace(`/${id}/suspend`)) {
      void loadStale().catch(reportError);
    }
  };

  const remove = async id => {
    let deleted;

    try {
      deleted = await request(`/${id}`, { method: 'DELETE' });
    } catch (error) {
      reportError(error);
      return false;
    }

    if (!deleted) {
      return false;
    }

    setError('');
    setItems(current => current.filter(item => item.id !== Number(id)));
    void loadStale().catch(reportError);

    return true;
  };

  return { items, staleItems, error, create, update, suspend, remove };
}
