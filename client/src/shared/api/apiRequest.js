import sharedConstants from '../../../../shared/constants.json';
import { LABELS } from '../lib/labels';

const API_URL = '/api';
const { HTTP_STATUS } = sharedConstants;

export const apiRequest = async (path, { method = 'GET', body } = {}) => {
  const options = { method };

  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);

  const data =
    response.status === HTTP_STATUS.NO_CONTENT ? true : await response.json().catch(() => null);

  if (!response.ok) {
    const detailMessages = Array.isArray(data?.details)
      ? data.details
          .filter(detail => typeof detail?.message === 'string' && detail.message)
          .map(detail => (detail.field ? `${detail.field}: ${detail.message}` : detail.message))
      : [];
    const fallbackMessage =
      response.status === HTTP_STATUS.BAD_GATEWAY
        ? LABELS.common.badGatewayError
        : LABELS.common.httpError.replace('{status}', response.status);
    const message =
      [detailMessages.join('; '), data?.message, data?.error, data?.description].find(Boolean) ||
      fallbackMessage;

    throw new Error(message);
  }

  return data;
};
