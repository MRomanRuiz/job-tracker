import sharedConstants from '../../../../shared/constants.json';

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
    const message =
      [detailMessages.join('; '), data?.message, data?.error, data?.description].find(Boolean) ||
      `Error ${response.status}`;

    throw new Error(message);
  }

  return data;
};
