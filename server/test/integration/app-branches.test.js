const path = require('node:path');

const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../../src/app');

const records = {
  applications: {
    id: 1,
    appliedAt: '2020-01-01',
    status: 'pending',
  },
  contacts: {
    id: 1,
    contactedAt: '2020-01-01',
    contact: 'Ana',
    center: 'Acme',
    status: 'pending',
    notes: '',
  },
};

const storage = {
  async list(name) {
    if (name === 'applications') {
      throw new Error('Storage unavailable');
    }

    return [];
  },
  async getById(name, id) {
    return id === '1' ? records[name] : null;
  },
  async update() {
    return null;
  },
  async updatePending() {
    return null;
  },
};

let server;
let baseUrl;

before(async () => {
  server = createApp({ storage, allowedOrigins: [] }).listen(0);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) {
    return;
  }

  const closed = new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });

  server.closeAllConnections?.();
  await closed;
});

const request = async (method, url, body) => {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
};

describe('additional app branches', () => {
  it('returns a server error when storage fails', async () => {
    const response = await request('GET', '/api/applications');

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      error: 'No se pudieron leer las candidaturas',
    });
  });

  it('rejects stale records when storage detects a concurrent change', async () => {
    const application = await request(
      'PATCH',
      '/api/applications/1/suspend',
    );
    const contact = await request(
      'PATCH',
      '/api/contacts/1/suspend',
    );

    assert.equal(application.status, 400);
    assert.equal(contact.status, 400);
  });

  it('returns 400 when a patch has no changes (contacts)', async () => {
    const response = await request('PATCH', '/api/contacts/1', {});

    assert.equal(response.status, 400);
  });

  it('returns 400 when a patch has no changes (application)', async () => {
    const response = await request('PATCH', '/api/applications/1', {});

    assert.equal(response.status, 400);
  });

  it('returns not found when suspending a missing contact', async () => {
    const response = await request(
      'PATCH',
      '/api/contacts/99/suspend',
    );

    assert.equal(response.status, 404);
  });

  it('passes unknown API paths to the not-found handler', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);

    assert.equal(response.status, 404);
  });

  it('serves the client fallback or reports a missing build', async () => {
    const indexPath = path.resolve(
      __dirname,
      '../../../client/dist/index.html',
    );
    const hasClientBuild = require('node:fs').existsSync(indexPath);
    const response = await fetch(`${baseUrl}/dashboard`);

    assert.equal(response.status, hasClientBuild ? 200 : 500);
  });

  it('handles oversized JSON through the generic error middleware', async () => {
    const response = await fetch(`${baseUrl}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'x'.repeat(1024 * 1024) }),
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'Error interno del servidor',
    });
  });
});
