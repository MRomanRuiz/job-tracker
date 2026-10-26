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

const OLD_DATE = '2020-01-01';
const RECENT_DATE = new Date().toISOString().slice(0, 10);

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
    status: 'replied',
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
    body: await response.json(),
  };
};

// Inicializa los archivos JSON dentro de un directorio temporal.
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

// Reinicia solamente las colecciones de la base de datos de pruebas.
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
    throw new Error(`TEST_STORAGE_TYPE no válido: ${STORAGE_TYPE}. Usa json o mongodb.`);
  }

  if (STORAGE_TYPE === 'json') {
    // No se utilizan ni modifican los archivos de datos reales.
    tempDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'job-tracker-test-'));

    process.env.JSON_DATA_DIR = tempDataDir;
    await resetJSONFiles();
  } else {
    // Impide borrar accidentalmente una base de datos real.
    if (process.env.MONGODB_DB !== TEST_DATABASE_NAME) {
      throw new Error(`Pruebas canceladas: MONGODB_DB debe ser "${TEST_DATABASE_NAME}".`);
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('Pruebas canceladas: falta MONGODB_URI en la configuración.');
    }

    const database = require('../../src/db');

    closeDB = database.closeDB;

    // Verifica la conexión real antes de ejecutar las pruebas.
    await database.connectDB();

    db = database.getDB();

    if (db.databaseName !== TEST_DATABASE_NAME) {
      throw new Error(`Pruebas canceladas: conexión a una base inesperada (${db.databaseName}).`);
    }

    await db.command({ ping: 1 });
  }

  // Se carga después de configurar JSON_DATA_DIR.
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
        throw new Error('Se cancela el borrado: la base conectada no es la base de test.');
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

describe('isOlderThanPendingLimit', () => {
  it('detecta fechas de más de 30 días', () => {
    const { isOlderThanPendingLimit } = require('../../src/app');
    const now = new Date('2026-02-01');

    assert.equal(isOlderThanPendingLimit('2025-12-01', now), true);
    assert.equal(isOlderThanPendingLimit('2026-01-15', now), false);
    assert.equal(isOlderThanPendingLimit('not-a-date', now), false);
  });
});

describe('applications', () => {
  it('lista candidaturas', async () => {
    const { status, body } = await request('GET', '/api/applications');

    assert.equal(status, 200);
    assert.equal(body.applications.length, 2);
    assert.equal(body.applications[0]._id, undefined);
    assert.equal(body.applications[0].country, 'España');
    assert.equal(body.applications[0].city, 'Madrid');
  });

  it('crea una candidatura con ID numérico generado por el servidor', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: {
        ...validApplication(),
        id: 'x',
        foo: 1,
      },
    });

    assert.equal(status, 201);
    assert.equal(typeof body.id, 'number');
    assert.equal(body.status, 'pending');
    assert.equal(body.foo, undefined);
    assert.equal(body._id, undefined);

    const { body: list } = await request('GET', '/api/applications');

    assert.equal(list.applications.length, 3);
    assert.ok(list.applications.some(application => application.id === body.id));
  });

  it('elimina los espacios al principio y al final de los campos de texto', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: {
        ...validApplication(),
        company: '  Acme España  ',
        position: '  Software Engineer  ',
        country: ' España  ',
        city: ' Málaga    ',
        durationType: 'fixed',
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

  it('permite una candidatura temporal sin duración indicada', async () => {
    const { status, body } = await request('POST', '/api/applications', {
      body: {
        ...validApplication(),
        durationType: 'fixed',
        durationMonths: null,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.durationType, 'fixed');
    assert.equal(body.durationMonths, null);
  });

  it('rechaza candidaturas no válidas', async () => {
    for (const body of [
      validApplication({ company: '   ' }),
      validApplication({ status: 'bogus' }),
      validApplication({ company: 42 }),
      validApplication({ appliedAt: '2026-02-31' }),
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

  it('actualiza el estado de una candidatura', async () => {
    const { status, body } = await request('PATCH', '/api/applications/1', {
      body: { status: 'interview' },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'interview');
  });

  it('actualiza solo las notas de una candidatura', async () => {
    const { status, body } = await request('PATCH', '/api/applications/1', {
      body: { notes: '  Revisar oferta  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.notes, '  Revisar oferta  ');
    assert.equal(body.status, 'pending');
  });

  it('rechaza un estado no permitido al actualizar una candidatura', async () => {
    const { status } = await request('PATCH', '/api/applications/1', {
      body: { status: 'bogus' },
    });

    assert.equal(status, 400);
  });

  it('devuelve 400 para un PATCH sin cuerpo', async () => {
    const { status } = await request('PATCH', '/api/applications/1');

    assert.equal(status, 400);
  });

  it('devuelve 400 para JSON mal formado', async () => {
    const { status } = await request('PATCH', '/api/applications/1', {
      body: '{bad json',
    });

    assert.equal(status, 400);
  });

  it('devuelve 404 para una candidatura inexistente', async () => {
    const { status } = await request('PATCH', '/api/applications/99', {
      body: { status: 'offer' },
    });

    assert.equal(status, 404);
  });

  it('lista y suspende candidaturas pendientes antiguas', async () => {
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

  it('genera IDs únicos con peticiones concurrentes', async () => {
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
  it('lista contactos', async () => {
    const { status, body } = await request('GET', '/api/contacts');

    assert.equal(status, 200);
    assert.equal(body.contacts.length, 2);
    assert.equal(body.contacts[0]._id, undefined);
    assert.equal(body.contacts[0].institution, 'Acme');
    assert.equal(body.contacts[0].email, 'ana@example.com');
  });

  it('crea un contacto', async () => {
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

    const { body: list } = await request('GET', '/api/contacts');

    assert.equal(list.contacts.length, 3);
    assert.ok(list.contacts.some(contact => contact.id === body.id));
  });

  it('rechaza contactos no válidos', async () => {
    for (const body of [
      validContact({ contact: '   ' }),
      validContact({ email: '' }),
      validContact({ institution: '' }),
      validContact({ country: '' }),
      validContact({ contactedAt: '2026-02-31' }),
      validContact({ status: 'bogus' }),
      validContact({ email: 42 }),
    ]) {
      const response = await request('POST', '/api/contacts', { body });

      assert.equal(response.status, 400);
    }
  });

  it('recorta los campos de texto de un contacto', async () => {
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

  it('actualiza el estado y las notas', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: { status: 'rejected', notes: 'Follow up' },
    });

    assert.equal(status, 200);
    assert.equal(body.status, 'rejected');
    assert.equal(body.notes, 'Follow up');
  });

  it('actualiza solo las notas de un contacto', async () => {
    const { status, body } = await request('PATCH', '/api/contacts/2', {
      body: { notes: '  Contactar mañana  ' },
    });

    assert.equal(status, 200);
    assert.equal(body.notes, '  Contactar mañana  ');
    assert.equal(body.status, 'replied');
  });

  it('rechaza un estado no permitido al actualizar un contacto', async () => {
    const { status } = await request('PATCH', '/api/contacts/2', {
      body: { status: 'bogus' },
    });

    assert.equal(status, 400);
  });

  it('rechaza notas que no sean texto', async () => {
    const { status } = await request('PATCH', '/api/contacts/2', {
      body: { notes: { a: 1 } },
    });

    assert.equal(status, 400);
  });

  it('devuelve 404 para un contacto inexistente', async () => {
    const { status } = await request('PATCH', '/api/contacts/99', {
      body: { notes: 'No existe' },
    });

    assert.equal(status, 404);
  });

  it('suspende contactos pendientes antiguos', async () => {
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
  it('permite el origen del frontend', async () => {
    const response = await fetch(`${baseUrl}/api/contacts`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  it('devuelve 403 para otros orígenes', async () => {
    const { status } = await request('GET', '/api/contacts', {
      headers: { Origin: 'http://evil.example' },
    });

    assert.equal(status, 403);
  });
});
