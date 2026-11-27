const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

const { after, before, beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env.test'),
  override: false,
});

const STORAGE_TYPE = (
  process.env.TEST_STORAGE_TYPE ||
  process.env.STORAGE_TYPE ||
  'json'
).toLowerCase();

process.env.STORAGE_TYPE = STORAGE_TYPE;

const TEST_DATABASE_NAME = 'job_tracker_test';

const OLD_DATE = '2020-01-01T00:00:00.000Z';
const RECENT_DATE = new Date().toISOString();

const validApplication = (overrides = {}) => ({
  company: 'Acme',
  position: 'Engineer',
  country: 'España',
  type: 'research',
  appliedAt: RECENT_DATE,
  ...overrides,
});

const validContact = (overrides = {}) => ({
  contact: 'Eva',
  email: 'eva@example.com',
  institution: 'Gamma',
  country: 'España',
  contactedAt: RECENT_DATE,
  ...overrides,
});

const initialApplications = [
  {
    id: 1,
    appliedAt: OLD_DATE,
    company: 'Old',
    position: 'Developer',
    country: 'España',
    city: 'Madrid',
    type: 'industry',
    status: 'pending',
    durationType: '',
    durationMonths: null,
    notes: '',
  },
  {
    id: 2,
    appliedAt: RECENT_DATE,
    company: 'New',
    position: 'Designer',
    country: 'España',
    city: 'Málaga',
    type: 'research',
    status: 'pending',
    durationType: '',
    durationMonths: null,
    notes: '',
  },
];

const initialContacts = [
  {
    id: 1,
    contact: 'Ana',
    email: 'ana@example.com',
    institution: 'Acme',
    department: '',
    city: 'Madrid',
    country: 'España',
    contactedAt: OLD_DATE,
    status: 'pending',
    notes: '',
  },
  {
    id: 2,
    contact: 'Luis',
    email: 'luis@example.com',
    institution: 'Beta',
    department: '',
    city: 'Málaga',
    country: 'España',
    contactedAt: RECENT_DATE,
    status: 'in_conversation',
    notes: '',
  },
];

let db;
let server;
let baseUrl;
let storage;
let closeDB = async () => {};
let tempDataDir;

const request = async (method, url, { body, headers = {} } = {}) => {
  const options = {
    method,
    headers: { ...headers },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${url}`, options);

  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
};

const resetJSONFiles = async () => {
  await fs.mkdir(tempDataDir, { recursive: true });

  await Promise.all([
    fs.writeFile(
      path.join(tempDataDir, 'jobs.json'),
      JSON.stringify({ applications: initialApplications }, null, 2),
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDataDir, 'contacts.json'),
      JSON.stringify({ contacts: initialContacts }, null, 2),
      'utf8',
    ),
  ]);
};

const clearMongoCollections = async () => {
  await Promise.all([
    db.collection('applications').deleteMany({}),
    db.collection('contacts').deleteMany({}),
    db.collection('_counters').deleteMany({}),
  ]);

  await Promise.all([
    db.collection('applications').insertMany(initialApplications),
    db.collection('contacts').insertMany(initialContacts),
  ]);
};

before(async () => {
  if (!['json', 'mongodb'].includes(STORAGE_TYPE)) {
    throw new Error(`Not valid TEST_STORAGE_TYPE: ${STORAGE_TYPE}. Use json o mongodb.`);
  }

  if (STORAGE_TYPE === 'json') {
    tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-tracker-test-'));

    process.env.JSON_DATA_DIR = tempDataDir;
    await resetJSONFiles();
  } else {
    if (process.env.MONGODB_DB !== TEST_DATABASE_NAME) {
      throw new Error(`Tests cancelled: MONGODB_DB must be "${TEST_DATABASE_NAME}".`);
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('Tests cancelled: MONGODB_URI is missing in the configuration.');
    }

    const database = require('../../src/db');

    closeDB = database.closeDB;

    await database.connectDB();

    db = database.getDB();

    if (db.databaseName !== TEST_DATABASE_NAME) {
      throw new Error(
        `Tests cancelled: connection to an unexpected database (${db.databaseName}).`,
      );
    }

    await db.command({ ping: 1 });
  }

  const { createStorage } = require('../../src/storage');
  const { createApp } = require('../../src/app');

  storage = createStorage(STORAGE_TYPE);

  server = createApp({ storage }).listen(0);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  if (STORAGE_TYPE === 'json') {
    await resetJSONFiles();
  } else {
    await clearMongoCollections();
  }
});

after(async () => {
  try {
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

    if (STORAGE_TYPE === 'mongodb' && db) {
      if (db.databaseName !== TEST_DATABASE_NAME) {
        throw new Error('Tests cancelled: connection to an unexpected database.');
      }

      await db.dropDatabase();
    }

    if (tempDataDir) {
      await fs.rm(tempDataDir, {
        recursive: true,
        force: true,
      });
    }
  } finally {
    await closeDB();
  }
});

describe('isOlderThanStaleLimit', () => {
  const { isOlderThanStaleLimit } = require('../../src/domain/records');

  it('detects dates older than 30 calendar days, ignoring time', () => {
    const now = new Date('2026-02-01T00:01:00.000Z');

    assert.equal(isOlderThanStaleLimit('2026-01-01T23:59:00.000Z', now), true);

    assert.equal(isOlderThanStaleLimit('2026-01-02T23:59:00.000Z', now), false);

    assert.equal(
      isOlderThanStaleLimit('2026-01-02T00:01:00.000Z', new Date('2026-02-01T23:59:00.000Z')),
      false,
    );
  });

  it('rejects invalid dates and timestamps that are not in the expected ISO format', () => {
    const now = new Date('2026-02-01T00:00:00.000Z');

    assert.equal(isOlderThanStaleLimit('2025-12-01T00:00:00.000Z', now), true);
    assert.equal(isOlderThanStaleLimit('2026-01-15T00:00:00.000Z', now), false);
    assert.equal(isOlderThanStaleLimit('2026-01-01', now), false);
    assert.equal(isOlderThanStaleLimit('not-a-date', now), false);
  });
});

describe('applications', () => {
  it('lists applications', async () => {
    const { status, body } = await request('GET', '/api/applications');

    assert.equal(status, 200);
    assert.equal(body.applications.length, 2);
    assert.equal(body.applications[0]._id, undefined);
    assert.equal(body.applications[0].country, 'España');
    assert.equal(body.applications[0].city, 'Madrid');
  });

  it('creates an application with a server-generated numeric ID', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: validApplication(),
    });

    assert.equal(status, 201);
    assert.equal(typeof body.id, 'number');
    assert.match(body.appliedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(body.status, 'pending');
    assert.equal(body._id, undefined);

    const { body: list } = await request('GET', '/api/applications');

    assert.equal(list.applications.length, 3);
    assert.ok(list.applications.some(application => application.id === body.id));
  });

  it('trims surrounding whitespace from application fields', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: {
        ...validApplication(),
        company: '  Acme España  ',
        position: '  Software Engineer  ',
        country: ' España  ',
        city: ' Málaga    ',
        durationType: ' fixed ',
        durationMonths: 6,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.company, 'Acme España');
    assert.equal(body.position, 'Software Engineer');
    assert.equal(body.country, 'España');
    assert.equal(body.city, 'Málaga');
    assert.equal(body.type, 'research');
    assert.equal(body.durationType, 'fixed');
    assert.equal(body.durationMonths, 6);
  });

  it('rejects invalid applications', async () => {
    for (const body of [
      validApplication({ company: '   ' }),
      validApplication({ country: '' }),
      validApplication({ status: 'bogus' }),
      validApplication({ company: 42 }),
      validApplication({ appliedAt: '2026-02-31T00:00:00.000Z' }),
      validApplication({ type: 'full-time' }),
      validApplication({ durationMonths: 6 }),
      validApplication({ durationType: 'temporary' }),
      validApplication({ durationType: 'fixed', durationMonths: 1.5 }),
      validApplication({ durationType: 'fixed', durationMonths: 0 }),
      validApplication({
        durationType: 'indefinite',
        durationMonths: 12,
      }),
    ]) {
      const response = await request('POST', '/api/applications', { body });

      assert.equal(response.status, 400);
    }
  });

  it('requires a country when creating an application', async () => {
    for (const body of [
      validApplication({ country: undefined }),
      validApplication({ country: ' ' }),
    ]) {
      const response = await request('POST', '/api/applications', { body });

      assert.equal(response.status, 400);
      assert.ok(response.body.details.some(detail => detail.field === 'country'));
    }
  });

  it('updates an application status', async () => {
    const { status, body } = await request('PATCH', '/api/applications/1', {
      body: { status: 'interview' },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'interview');
  });

  it('updates only application notes', async () => {
    const { status, body } = await request('PATCH', '/api/applications/1', {
      body: { notes: '  Revisar oferta  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.notes, 'Revisar oferta');
    assert.equal(body.status, 'pending');
  });

  it('preserves concurrent updates and hides the internal revision', async () => {
    await Promise.all([
      storage.update('applications', 2, { status: 'interview' }),
      storage.update('applications', 2, { notes: 'Seguimiento concurrente' }),
    ]);

    const { body } = await request('GET', '/api/applications');
    const application = body.applications.find(item => item.id === 2);

    assert.equal(application.status, 'interview');
    assert.equal(application.notes, 'Seguimiento concurrente');
    assert.equal(Object.hasOwn(application, '_storageRevision'), false);
    assert.deepEqual(application.history.map(event => event.field).sort(), ['status']);

    if (STORAGE_TYPE === 'mongodb') {
      const stored = await db.collection('applications').findOne({ id: 2 });
      assert.equal(stored._storageRevision, 2);
    }
  });

  it('rejects an unsupported application status', async () => {
    for (const status of ['bogus', 'suspended']) {
      const response = await request('PATCH', '/api/applications/1', {
        body: { status },
      });

      assert.equal(response.status, 400);
    }
  });

  it('enforces valid application status transitions', async () => {
    const interview = await request('PATCH', '/api/applications/2', {
      body: { status: 'interview' },
    });

    assert.equal(interview.status, 200);
    assert.equal(interview.body.status, 'interview');

    const offer = await request('PATCH', '/api/applications/2', {
      body: { status: 'offer' },
    });

    assert.equal(offer.status, 200);
    assert.equal(offer.body.status, 'offer');

    const accepted = await request('PATCH', '/api/applications/2', {
      body: { status: 'accepted' },
    });

    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.status, 'accepted');

    const fromAccepted = await request('PATCH', '/api/applications/2', {
      body: { status: 'pending' },
    });

    assert.equal(fromAccepted.status, 409);
    assert.equal(fromAccepted.body.message, 'Invalid application status transition');
  });

  it('rejects application status transitions that skip stages', async () => {
    const response = await request('PATCH', '/api/applications/2', {
      body: { status: 'offer' },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.message, 'Invalid application status transition');
  });

  it('allows declining an application with an offer', async () => {
    await request('PATCH', '/api/applications/2', {
      body: { status: 'interview' },
    });
    await request('PATCH', '/api/applications/2', {
      body: { status: 'offer' },
    });

    const response = await request('PATCH', '/api/applications/2', {
      body: { status: 'declined' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'declined');
  });

  it('updates application details and trims text fields', async () => {
    const { status, body } = await request('PATCH', '/api/applications/2', {
      body: {
        company: '  Example Labs  ',
        position: '  Researcher  ',
        type: '  research  ',
        city: '  Madrid  ',
        country: '  España  ',
        notes: '  Seguimiento  ',
        appliedAt: '2026-10-20T12:30:00.000Z',
        durationType: ' fixed ',
        durationMonths: 12,
        status: 'interview',
      },
    });

    assert.equal(status, 200);
    assert.equal(body.company, 'Example Labs');
    assert.equal(body.position, 'Researcher');
    assert.equal(body.type, 'research');
    assert.equal(body.city, 'Madrid');
    assert.equal(body.country, 'España');
    assert.equal(body.notes, 'Seguimiento');
    assert.equal(body.appliedAt, '2026-10-20T12:30:00.000Z');
    assert.equal(body.durationType, 'fixed');
    assert.equal(body.durationMonths, 12);
    assert.equal(body.status, 'interview');
  });

  it('allows partial application updates and preserves omitted fields', async () => {
    const { status, body } = await request('PATCH', '/api/applications/2', {
      body: { notes: '  Revisar la oferta  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.notes, 'Revisar la oferta');
    assert.equal(body.company, 'New');
    assert.equal(body.position, 'Designer');
    assert.equal(body.type, 'research');
    assert.equal(body.status, 'pending');
  });

  it('rejects invalid application details', async () => {
    for (const body of [
      { company: '   ' },
      { position: '' },
      { type: 'invalid' },
      { appliedAt: '2026-02-31T00:00:00.000Z' },
      { appliedAt: '2026-10-20' },
      { durationType: 'temporary' },
      { durationMonths: 0 },
      { durationMonths: 1.5 },
      { durationType: 'indefinite', durationMonths: 12 },
      { status: 'invalid' },
      { unknown: 'value' },
      {},
    ]) {
      const response = await request('PATCH', '/api/applications/2', { body });

      assert.equal(response.status, 400);
    }
  });

  it('returns 404 when updating the details of a missing application', async () => {
    const { status } = await request('PATCH', '/api/applications/99', {
      body: { company: 'Example' },
    });

    assert.equal(status, 404);
  });

  it('deletes an application', async () => {
    const { status, body } = await request('DELETE', '/api/applications/1');

    assert.equal(status, 204);
    assert.equal(body, null);

    const { body: list } = await request('GET', '/api/applications');

    assert.deepEqual(
      list.applications.map(application => application.id),
      [2],
    );
  });

  it('returns 404 when deleting a missing application', async () => {
    const { status } = await request('DELETE', '/api/applications/99');

    assert.equal(status, 404);
  });

  it('returns 400 for a PATCH request without a body', async () => {
    const { status } = await request('PATCH', '/api/applications/1');

    assert.equal(status, 400);
  });

  it('rejects null and array PATCH bodies', async () => {
    for (const body of [null, []]) {
      const { status } = await request('PATCH', '/api/applications/1', { body });

      assert.equal(status, 400);
    }
  });

  it('returns 400 for malformed JSON', async () => {
    const { status } = await request('PATCH', '/api/applications/1', {
      body: '{bad json',
    });

    assert.equal(status, 400);
  });

  it('returns 404 for a missing application', async () => {
    const { status } = await request('PATCH', '/api/applications/99', {
      body: { status: 'offer' },
    });

    assert.equal(status, 404);
  });

  it('lists and suspends old pending applications', async () => {
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

  it('alerts and suspends stale interview applications', async () => {
    const created = await request('POST', '/api/applications', {
      body: validApplication({
        appliedAt: '2020-01-01T00:00:00.000Z',
        status: 'interview',
      }),
    });
    assert.equal(created.status, 201);

    const old = await request('GET', '/api/applications/old');

    assert.equal(
      old.body.applications.some(item => item.id === created.body.id),
      true,
    );

    const suspended = await request('PATCH', `/api/applications/${created.body.id}/suspend`);

    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, 'suspended');
    const oldAfterSuspension = await request('GET', '/api/applications/old');
    assert.equal(
      oldAfterSuspension.body.applications.some(item => item.id === created.body.id),
      false,
    );
  });

  it('does not alert an interview application whose status changed recently', async () => {
    const created = await request('POST', '/api/applications', {
      body: validApplication({ appliedAt: '2020-01-01T00:00:00.000Z' }),
    });
    const updated = await request('PATCH', `/api/applications/${created.body.id}`, {
      body: { status: 'interview' },
    });
    assert.equal(updated.status, 200);

    const old = await request('GET', '/api/applications/old');

    assert.equal(
      old.body.applications.some(item => item.id === created.body.id),
      false,
    );

    const suspended = await request('PATCH', `/api/applications/${created.body.id}/suspend`);

    assert.equal(suspended.status, 400);
  });

  it('excludes offer and final application statuses from stale alerts', async () => {
    for (const status of ['offer', 'accepted', 'declined', 'rejected']) {
      await request('POST', '/api/applications', {
        body: validApplication({
          appliedAt: '2020-01-01T00:00:00.000Z',
          status,
        }),
      });
    }

    const old = await request('GET', '/api/applications/old');

    assert.deepEqual(
      old.body.applications.map(item => item.id),
      [1],
    );
  });

  it('does not reset application expiration when only notes change', async () => {
    await request('PATCH', '/api/applications/1', {
      body: { notes: 'New follow-up detail' },
    });

    const old = await request('GET', '/api/applications/old');

    assert.deepEqual(
      old.body.applications.map(item => item.id),
      [1],
    );
  });

  it('allows editing details while keeping a suspended application suspended', async () => {
    const created = await request('POST', '/api/applications', {
      body: validApplication({ appliedAt: '2020-01-01T00:00:00.000Z' }),
    });
    const suspended = await request('PATCH', `/api/applications/${created.body.id}/suspend`);

    assert.equal(suspended.status, 200);

    const updated = await request('PATCH', `/api/applications/${created.body.id}`, {
      body: { company: 'Updated while suspended' },
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.body.company, 'Updated while suspended');
    assert.equal(updated.body.status, 'suspended');
  });

  it('generates unique IDs for concurrent requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        request('POST', '/api/applications', {
          body: {
            ...validApplication(),
            company: `Company ${index}`,
          },
        }),
      ),
    );

    assert.ok(responses.every(response => response.status === 201));

    const { body: list } = await request('GET', '/api/applications');

    const applications = list.applications;

    assert.equal(applications.length, 12);
    assert.equal(new Set(applications.map(item => item.id)).size, 12);
  });
});

describe('contacts', () => {
  it('lists contacts', async () => {
    const { status, body } = await request('GET', '/api/contacts');

    assert.equal(status, 200);
    assert.equal(body.contacts.length, 2);
    assert.equal(body.contacts[0]._id, undefined);
    assert.equal(body.contacts[0].institution, 'Acme');
    assert.equal(body.contacts[0].email, 'ana@example.com');
  });

  it('creates a contact', async () => {
    const { status, body } = await request('POST', '/api/contacts', {
      body: {
        ...validContact({ institution: 'Gamma' }),
      },
    });

    assert.equal(status, 201);
    assert.equal(typeof body.id, 'number');
    assert.equal(body.notes, '');
    assert.equal(body.status, 'pending');
    assert.equal(body._id, undefined);
    assert.equal(body.institution, 'Gamma');
    assert.match(body.contactedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const { body: list } = await request('GET', '/api/contacts');

    assert.equal(list.contacts.length, 3);
    assert.ok(list.contacts.some(contact => contact.id === body.id));
  });

  it('rejects invalid contacts', async () => {
    for (const body of [
      validContact({ contact: '   ' }),
      validContact({ email: '' }),
      validContact({ institution: '' }),
      validContact({ country: '' }),
      validContact({ contactedAt: '2026-02-31T00:00:00.000Z' }),
      validContact({ status: 'bogus' }),
      validContact({ email: 42 }),
    ]) {
      const response = await request('POST', '/api/contacts', { body });

      assert.equal(response.status, 400);
    }
  });

  it('trims contact text fields', async () => {
    const { status, body } = await request('POST', '/api/contacts', {
      body: validContact({
        contact: '  Eva Martínez  ',
        email: ' eva@example.com ',
        institution: ' Gamma ',
        department: ' Investigación ',
        city: ' Madrid ',
        country: ' España ',
        notes: '  Primer contacto  ',
      }),
    });

    assert.equal(status, 201);
    assert.equal(body.contact, 'Eva Martínez');
    assert.equal(body.email, 'eva@example.com');
    assert.equal(body.institution, 'Gamma');
    assert.equal(body.department, 'Investigación');
    assert.equal(body.city, 'Madrid');
    assert.equal(body.country, 'España');
    assert.equal(body.notes, 'Primer contacto');
  });

  it('updates a contact status and notes', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: { status: 'rejected', notes: 'Follow up' },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'rejected');
    assert.equal(body.notes, 'Follow up');
  });

  it('updates only contact notes', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: { notes: '  Contactar mañana  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.notes, 'Contactar mañana');
    assert.equal(body.status, 'in_conversation');
  });

  it('rejects an unsupported contact status', async () => {
    const { status } = await request('PATCH', '/api/contacts/2', {
      body: { status: 'bogus' },
    });

    assert.equal(status, 400);
  });

  it('allows configured contact status transitions', async () => {
    const followUp = await request('PATCH', '/api/contacts/2', {
      body: { status: 'follow_up' },
    });

    assert.equal(followUp.status, 200);
    assert.equal(followUp.body.status, 'follow_up');

    const backToPending = await request('PATCH', '/api/contacts/2', {
      body: { status: 'pending' },
    });

    assert.equal(backToPending.status, 200);
    assert.equal(backToPending.body.status, 'pending');

    const completed = await request('PATCH', '/api/contacts/2', {
      body: { status: 'in_conversation' },
    });

    assert.equal(completed.status, 200);

    const complete = await request('PATCH', '/api/contacts/2', {
      body: { status: 'completed' },
    });

    assert.equal(complete.status, 200);
    assert.equal(complete.body.status, 'completed');
  });

  it('rejects invalid contact status transitions', async () => {
    for (const status of ['pending', 'bogus']) {
      const response = await request('PATCH', '/api/contacts/2', {
        body: { status },
      });

      assert.equal(response.status, status === 'bogus' ? 400 : 409);
      assert.equal(
        response.body.message,
        status === 'bogus' ? 'Invalid contact data' : 'Invalid contact status transition',
      );
    }

    const completed = await request('PATCH', '/api/contacts/2', {
      body: { status: 'completed' },
    });

    assert.equal(completed.status, 200);

    const fromCompleted = await request('PATCH', '/api/contacts/2', {
      body: { status: 'pending' },
    });

    assert.equal(fromCompleted.status, 409);
    assert.equal(fromCompleted.body.message, 'Invalid contact status transition');
  });

  it('does not allow transitions out of terminal statuses', async () => {
    await request('PATCH', '/api/contacts/2', {
      body: { status: 'rejected' },
    });

    const response = await request('PATCH', '/api/contacts/2', {
      body: { status: 'pending' },
    });

    assert.equal(response.status, 409);
    assert.equal(response.body.message, 'Invalid contact status transition');
  });

  it('allows a suspended contact to resume', async () => {
    await request('PATCH', '/api/contacts/1/suspend');

    const response = await request('PATCH', '/api/contacts/1', {
      body: { status: 'in_conversation' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'in_conversation');
  });

  it('updates contact details and trims text fields', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: {
        contact: '  Luis Pérez  ',
        email: ' luis.perez@example.com ',
        institution: ' Beta Labs ',
        department: ' Investigación ',
        city: ' Málaga ',
        country: ' España ',
        notes: '  Contactar en noviembre  ',
        contactedAt: '2026-10-20T12:30:00.000Z',
        status: 'follow_up',
      },
    });

    assert.equal(status, 200);
    assert.equal(body.contact, 'Luis Pérez');
    assert.equal(body.email, 'luis.perez@example.com');
    assert.equal(body.institution, 'Beta Labs');
    assert.equal(body.department, 'Investigación');
    assert.equal(body.city, 'Málaga');
    assert.equal(body.country, 'España');
    assert.equal(body.notes, 'Contactar en noviembre');
    assert.equal(body.contactedAt, '2026-10-20T12:30:00.000Z');
    assert.equal(body.status, 'follow_up');
  });

  it('allows partial contact updates and preserves omitted fields', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: { department: '  Ciencias  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.department, 'Ciencias');
    assert.equal(body.contact, 'Luis');
    assert.equal(body.email, 'luis@example.com');
    assert.equal(body.status, 'in_conversation');
  });

  it('rejects invalid contact details', async () => {
    for (const body of [
      { contact: '   ' },
      { email: '' },
      { institution: '   ' },
      { country: '' },
      { department: 42 },
      { contactedAt: '2026-02-31T00:00:00.000Z' },
      { contactedAt: '2026-10-20' },
      { status: 'bogus' },
      { unexpected: 'value' },
      {},
    ]) {
      const response = await request('PATCH', '/api/contacts/2', { body });

      assert.equal(
        response.status,
        400,
        `Expected 400 for body: ${JSON.stringify(body)}, received ${response.status}`,
      );
    }
  });

  it('returns 404 when updating the details of a missing contact', async () => {
    const { status } = await request('PATCH', '/api/contacts/99', {
      body: { contact: 'Eva' },
    });

    assert.equal(status, 404);
  });

  it('deletes a contact', async () => {
    const { status, body } = await request('DELETE', '/api/contacts/1');

    assert.equal(status, 204);
    assert.equal(body, null);

    const { body: list } = await request('GET', '/api/contacts');

    assert.deepEqual(
      list.contacts.map(contact => contact.id),
      [2],
    );
  });

  it('returns 404 when deleting a missing contact', async () => {
    const { status } = await request('DELETE', '/api/contacts/99');

    assert.equal(status, 404);
  });

  it('rejects null and array PATCH bodies', async () => {
    for (const body of [null, []]) {
      const { status } = await request('PATCH', '/api/contacts/1', { body });

      assert.equal(status, 400);
    }
  });

  it('rejects non-string notes', async () => {
    const { status } = await request('PATCH', '/api/contacts/2', {
      body: { notes: { a: 1 } },
    });

    assert.equal(status, 400);
  });

  it('returns 404 for a missing contact', async () => {
    const { status } = await request('PATCH', '/api/contacts/99', {
      body: { notes: 'No existe' },
    });

    assert.equal(status, 404);
  });

  it('suspends old pending contacts', async () => {
    const old = await request('GET', '/api/contacts/old');
    console.log('GET /api/contacts/old:', old.status, old.body);
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

  it('alerts and suspends stale in-conversation contacts', async () => {
    const created = await request('POST', '/api/contacts', {
      body: validContact({
        contactedAt: '2020-01-01T00:00:00.000Z',
        status: 'in_conversation',
      }),
    });
    assert.equal(created.status, 201);

    const old = await request('GET', '/api/contacts/old');

    assert.equal(
      old.body.contacts.some(item => item.id === created.body.id),
      true,
    );

    const suspended = await request('PATCH', `/api/contacts/${created.body.id}/suspend`);

    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.status, 'suspended');
    const oldAfterSuspension = await request('GET', '/api/contacts/old');
    assert.equal(
      oldAfterSuspension.body.contacts.some(item => item.id === created.body.id),
      false,
    );
  });

  it('excludes final and follow-up contact statuses from stale alerts', async () => {
    for (const status of ['completed', 'rejected', 'follow_up']) {
      await request('POST', '/api/contacts', {
        body: validContact({
          contactedAt: '2020-01-01T00:00:00.000Z',
          status,
        }),
      });
    }

    const old = await request('GET', '/api/contacts/old');

    assert.deepEqual(
      old.body.contacts.map(item => item.id),
      [1],
    );
  });

  it('resets contact expiration when it returns to pending after a status change', async () => {
    await request('PATCH', '/api/contacts/1', {
      body: { status: 'follow_up' },
    });
    const returnedToPending = await request('PATCH', '/api/contacts/1', {
      body: { status: 'pending' },
    });
    const old = await request('GET', '/api/contacts/old');

    assert.equal(returnedToPending.status, 200);
    assert.equal(returnedToPending.body.history.length, 2);
    assert.deepEqual(
      old.body.contacts.map(item => item.id),
      [],
    );
  });
});

describe('CORS', () => {
  it('allows the frontend origin', async () => {
    const response = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  it('returns 403 for untrusted origins', async () => {
    const { status } = await request('GET', '/api/contacts', {
      headers: { Origin: 'http://evil.example' },
    });

    assert.equal(status, 403);
  });
});
