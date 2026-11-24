import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../api/apiRequest';
import { LABELS } from '../lib/labels';
import { replaceById } from '../lib/utils';

export default function useCollection(name) {
  const [items, setItems] = useState([]);
  const [staleAlerts, setStaleAlerts] = useState([]);
  const [error, setError] = useState('');
  const latestStaleRequest = useRef(0);
  const [alertsError, setAlertsError] = useState('');

  const entity = name === 'applications' ? 'application' : 'contact';

  const staleItems = useMemo(() => {
    const staleIds = new Set(
      staleAlerts
        .filter(alert => alert.entity === entity && alert.type === 'stale')
        .map(alert => String(alert.recordId)),
    );

    return items.filter(item => staleIds.has(String(item.id)));
  }, [items, staleAlerts, entity]);

  const scheduledItems = useMemo(() => {
    const scheduledIds = new Set(
      staleAlerts
        .filter(alert => alert.entity === entity && alert.type === 'scheduled')
        .map(alert => String(alert.recordId)),
    );

    return items.filter(item => scheduledIds.has(String(item.id)));
  }, [items, staleAlerts, entity]);

  const reportError = useCallback(requestError => {
    setError(
      typeof requestError?.message === 'string' && requestError.message
        ? requestError.message
        : LABELS.common.requestError,
    );
  }, []);

  const request = useCallback(
    async (path = '', options = {}) => {
      const url = `/${name}${path}`;

      return apiRequest(url, options);
    },
    [name],
  );

  const loadStale = useCallback(async () => {
    latestStaleRequest.current += 1;
    const requestId = latestStaleRequest.current;

    try {
      const data = await apiRequest('/alerts');

      if (data && requestId === latestStaleRequest.current) {
        setStaleAlerts(data.alerts ?? []);
        setAlertsError('');
      }
    } catch (requestError) {
      if (requestId === latestStaleRequest.current) {
        setAlertsError(
          typeof requestError?.message === 'string' && requestError.message
            ? requestError.message
            : LABELS.common.requestError,
        );
      }
    }
  }, []);

  useEffect(() => {
    void request()
      .then(data => {
        if (data) {
          setItems(data[name]);
          setError('');
        }
      })
      .catch(reportError);

    void loadStale().catch(reportError);
  }, [name, request, loadStale, reportError]);

  const replace = async (path, body, { throwErrors = false } = {}) => {
    let updated;

    try {
      updated = await request(path, { method: 'PATCH', body });
    } catch (requestError) {
      reportError(requestError);

      if (throwErrors) {
        throw requestError;
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
    } catch (requestError) {
      reportError(requestError);
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
    } catch (requestError) {
      reportError(requestError);
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

  return {
    items,
    staleItems,
    scheduledItems,
    error,
    alertsError,
    create,
    update,
    suspend,
    remove,
  };
}
