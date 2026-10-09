const { after, before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp, isOlderThanPendingLimit } = require('../app');

const OLD_DATE = '2020-01-01';
const RECENT_DATE = new Date().toISOString().slice(0, 10);

let dataDir;
let server;
let baseUrl;

const writeData = async (applications, contacts) => {
  await fs.writeFile(
    path.join(dataDir, 'jobs.json'),
    JSON.stringify({ applications }),
  );
  await fs.writeFile(
    path.join(dataDir, 'contacts.json'),
    JSON.stringify({ contacts }),
  );
};

const readData = async file =>
  JSON.parse(await fs.readFile(path.join(dataDir, file), 'utf8'));

const request = async (method, url, { body, headers = {} } = {}) => {
  const options = { method, headers: { ...headers } };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${url}`, options);

  return { status: response.status, body: await response.json() };
};

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-tracker-'));
  server = createApp({ dataDir }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await writeData(
    [
      { id: 1, appliedAt: OLD_DATE, company: 'Old', status: 'pending' },
      { id: 2, appliedAt: RECENT_DATE, company: 'New', status: 'pending' },
    ],
    [
      {
        id: 1,
        contact: 'Ana',
        center: 'Acme',
        contactedAt: OLD_DATE,
        status: 'pending',
        notes: '',
      },
      {
        id: 2,
        contact: 'Luis',
        center: 'Beta',
        contactedAt: RECENT_DATE,
        status: 'replied',
        notes: '',
      },
    ],
  );
});

describe('isOlderThanPendingLimit', () => {
  it('detects dates older than 30 days', () => {
    const now = new Date('2026-02-01');

    assert.equal(isOlderThanPendingLimit('2025-12-01', now), true);
    assert.equal(isOlderThanPendingLimit('2026-01-15', now), false);
    assert.equal(isOlderThanPendingLimit('not-a-date', now), false);
  });
});

describe('applications', () => {
  it('lists applications', async () => {
    const { status, body } = await request('GET', '/api/applications');

    assert.equal(status, 200);
    assert.equal(body.applications.length, 2);
  });

  it('creates an application with a server-generated id', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: { id: 'x', company: 'Acme', appliedAt: RECENT_DATE, foo: 1 },
    });

    assert.equal(status, 201);
    assert.equal(typeof body.id, 'number');
    assert.equal(body.status, 'pending');
    assert.equal(body.foo, undefined);

    const { applications } = await readData('jobs.json');
    assert.equal(applications.length, 3);
  });

  it('rejects invalid applications', async () => {
    for (const body of [
      { company: 'Acme' },
      { appliedAt: RECENT_DATE, status: 'bogus' },
      { appliedAt: RECENT_DATE, company: 42 },
    ]) {
      const response = await request('POST', '/api/applications', { body });
      assert.equal(response.status, 400);
    }
  });

  it('updates the status', async () => {
    const { status, body } = await request('PATCH', '/api/applications/1', {
      body: { status: 'interview' },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'interview');
  });

  it('returns 400 for a PATCH without body', async () => {
    const { status } = await request('PATCH', '/api/applications/1');

    assert.equal(status, 400);
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const { status } = await request('PATCH', '/api/applications/1', {
      body: '{bad json',
    });

    assert.equal(status, 400);
  });

  it('returns 404 for unknown applications', async () => {
    const { status } = await request('PATCH', '/api/applications/99', {
      body: { status: 'offer' },
    });

    assert.equal(status, 404);
  });

  it('lists and suspends stale pending applications', async () => {
    const old = await request('GET', '/api/applications/old');
    assert.deepEqual(
      old.body.applications.map(item => item.id),
      [1],
    );

    const suspended = await request('PATCH', '/api/applications/1/suspend');
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, 'suspended');

    const recent = await request('PATCH', '/api/applications/2/suspend');
    assert.equal(recent.status, 400);
  });

  it('keeps every update under concurrent requests', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        request('POST', '/api/applications', {
          body: { company: `C${index}`, appliedAt: RECENT_DATE },
        }),
      ),
    );

    const { applications } = await readData('jobs.json');
    assert.equal(applications.length, 12);
    assert.equal(new Set(applications.map(item => item.id)).size, 12);
  });

  it('returns 500 without crashing when the data file is corrupted', async () => {
    await fs.writeFile(path.join(dataDir, 'jobs.json'), '{oops');

    const first = await request('GET', '/api/applications');
    assert.equal(first.status, 500);

    const contacts = await request('GET', '/api/contacts');
    assert.equal(contacts.status, 200);
  });
});

describe('contacts', () => {
  it('lists contacts', async () => {
    const { status, body } = await request('GET', '/api/contacts');

    assert.equal(status, 200);
    assert.equal(body.contacts.length, 2);
  });

  it('creates a contact', async () => {
    const { status, body } = await request('POST', '/api/contacts', {
      body: {
        contact: 'Eva',
        center: 'Gamma',
        contactedAt: RECENT_DATE,
        status: 'pending',
      },
    });

    assert.equal(status, 201);
    assert.equal(body.notes, '');
  });

  it('rejects invalid contacts', async () => {
    const { status } = await request('POST', '/api/contacts', {
      body: { contact: 'Eva', center: '', contactedAt: RECENT_DATE },
    });

    assert.equal(status, 400);
  });

  it('updates status and notes', async () => {
    const { body } = await request('PATCH', '/api/contacts/2', {
      body: { status: 'rejected', notes: 'Follow up' },
    });

    assert.equal(body.status, 'rejected');
    assert.equal(body.notes, 'Follow up');
  });

  it('rejects non-string notes', async () => {
    const { status } = await request('PATCH', '/api/contacts/2', {
      body: { notes: { a: 1 } },
    });

    assert.equal(status, 400);
  });

  it('suspends stale pending contacts', async () => {
    const old = await request('GET', '/api/contacts/old');
    assert.deepEqual(
      old.body.contacts.map(item => item.id),
      [1],
    );

    const suspended = await request('PATCH', '/api/contacts/1/suspend');
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, 'suspended');

    const notPending = await request('PATCH', '/api/contacts/2/suspend');
    assert.equal(notPending.status, 400);
  });
});

describe('CORS', () => {
  it('allows the frontend origin', async () => {
    const response = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    );
  });

  it('returns 403 for other origins', async () => {
    const { status } = await request('GET', '/api/contacts', {
      headers: { Origin: 'http://evil.example' },
    });

    assert.equal(status, 403);
  });
});
