const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');

const appPath = require.resolve('../../src/app');
const originalExternalURL = process.env.RENDER_EXTERNAL_URL;
let server;
let baseUrl;
let createApp;

before(async () => {
  process.env.RENDER_EXTERNAL_URL = 'https://job-tracker.example';
  delete require.cache[appPath];

  ({ createApp } = require('../../src/app'));
  const app = createApp({
    storage: {
      async list() {
        return [];
      },
    },
  });

  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    const closed = new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });

    server.closeAllConnections?.();
    await closed;
  }

  if (originalExternalURL === undefined) {
    delete process.env.RENDER_EXTERNAL_URL;
  } else {
    process.env.RENDER_EXTERNAL_URL = originalExternalURL;
  }

  delete require.cache[appPath];
});

describe('default CORS origins', () => {
  it('creates default storage when none is injected', () => {
    assert.equal(typeof createApp().get, 'function');
  });

  it('allows the configured deployment origin', async () => {
    const response = await fetch(`${baseUrl}/api/applications`, {
      headers: { Origin: 'https://job-tracker.example' },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'https://job-tracker.example',
    );
  });
});
