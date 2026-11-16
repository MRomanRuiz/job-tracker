const API_URL = '/api';

const HTTP_STATUS = {
  NO_CONTENT: 204,
};

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
    throw new Error(data?.error ?? `Error ${response.status}`);
  }

  return data;
};
