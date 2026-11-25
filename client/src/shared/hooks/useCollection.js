import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../api/apiRequest';
import { LABELS } from '../lib/labels';
import { replaceById } from '../lib/utils';

export default function useCollection(name) {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const latestAlertsRequest = useRef(0);
  const pendingAlertsRequest = useRef(null);
  const [alertsError, setAlertsError] = useState('');

  const entity = name === 'applications' ? 'application' : 'contact';

  const staleItems = useMemo(() => {
    const staleIds = new Set(
      alerts
        .filter(alert => alert.entity === entity && alert.type === 'stale')
        .map(alert => String(alert.recordId)),
    );

    return items.filter(item => staleIds.has(String(item.id)));
  }, [items, alerts, entity]);

  const scheduledItems = useMemo(() => {
    const scheduledIds = new Set(
      alerts
        .filter(alert => alert.entity === entity && alert.type === 'scheduled')
        .map(alert => String(alert.recordId)),
    );

    return items.filter(item => scheduledIds.has(String(item.id)));
  }, [items, alerts, entity]);

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

  const loadAlerts = useCallback(async (refreshAfterPending = false) => {
    if (refreshAfterPending && pendingAlertsRequest.current) {
      await Promise.allSettled([pendingAlertsRequest.current]);
    }

    latestAlertsRequest.current += 1;
    const requestId = latestAlertsRequest.current;
    const pendingRequest = apiRequest('/alerts', { deduplicate: true });
    pendingAlertsRequest.current = pendingRequest;

    try {
      const data = await pendingRequest;

      if (data && requestId === latestAlertsRequest.current) {
        setAlerts(data.alerts ?? []);
        setAlertsError('');
      }
    } catch (requestError) {
      if (requestId === latestAlertsRequest.current) {
        setAlertsError(
          typeof requestError?.message === 'string' && requestError.message
            ? requestError.message
            : LABELS.common.requestError,
        );
      }
    } finally {
      if (pendingAlertsRequest.current === pendingRequest) {
        pendingAlertsRequest.current = null;
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

    void Promise.resolve().then(() => loadAlerts());
  }, [name, request, reportError, loadAlerts]);

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
    void loadAlerts(true);

    return true;
  };

  const update = async (id, changes) => {
    const updated = await replace(`/${id}`, changes, { throwErrors: true });

    if (updated && (changes.status !== undefined || changes.scheduledAt !== undefined)) {
      void loadAlerts(true);
    }

    return updated;
  };

  const suspend = async id => {
    if (await replace(`/${id}/suspend`)) {
      void loadAlerts(true);
    }
  };

  const recontact = async id => {
    const updated = await replace(`/${id}`, { status: 'in_conversation' });

    if (updated) {
      void loadAlerts(true);
    }

    return Boolean(updated);
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
    void loadAlerts(true);

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
    recontact,
    remove,
  };
}
