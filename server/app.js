const express = require('express');
const cors = require('cors');
const fs = require('node:fs/promises');
const path = require('node:path');

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NOT_FOUND: 404,
};

const MAX_PENDING_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_APPLICATION_STATUSES = new Set([
  'pending',
  'interview',
  'offer',
  'rejected',
]);

const ALLOWED_CONTACT_STATUSES = new Set([
  'pending',
  'replied',
  'rejected',
]);

const APPLICATION_TEXT_FIELDS = [
  'company',
  'position',
  'location',
  'type',
  'field',
  'duration',
  'document',
];

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
];

const DEFAULT_DATA_DIR = path.join(
  __dirname,
  '..',
  'client',
  'src',
  'data',
);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isOlderThanPendingLimit = (date, now = new Date()) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return (now - parsedDate) / MS_PER_DAY > MAX_PENDING_DAYS;
};

const isStalePending = (record, dateField) =>
  record.status === 'pending' && isOlderThanPendingLimit(record[dateField]);

const isValidDate = value => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const createCollectionStore = (filePath, key) => {
  let queue = Promise.resolve();

  const read = async () => {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

    if (!Array.isArray(data[key])) {
      throw new TypeError(`${path.basename(filePath)} no contiene "${key}"`);
    }

    return data;
  };

  const write = async data => {
    const tempFile = `${filePath}.${process.pid}.tmp`;

    await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempFile, filePath);
  };

  const list = async () => {
    const data = await read();
    return data[key];
  };

  // Serializes read-modify-write cycles so concurrent requests can't lose updates.
  const update = mutate => {
    const run = queue.then(async () => {
      const data = await read();
      const result = await mutate(data[key]);

      await write(data);

      return result;
    });

    queue = run.catch(() => {});

    return run;
  };

  return { list, update };
};

const findById = (items, id, notFoundMessage) => {
  const item = items.find(entry => entry.id === Number(id));

  if (!item) {
    throw new HttpError(HTTP_STATUS.NOT_FOUND, notFoundMessage);
  }

  return item;
};

const generateId = items =>
  Math.max(Date.now(), ...items.map(item => Number(item.id) + 1 || 0));

const handle = (errorMessage, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    console.info(err);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: errorMessage });
  }
};

const suspendIfStale = (record, dateField, messages) => {
  if (record.status !== 'pending') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.notPending);
  }

  if (!isOlderThanPendingLimit(record[dateField])) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.tooRecent);
  }

  record.status = 'suspended';

  return record;
};

const parseApplication = body => {
  const application = {};

  for (const field of APPLICATION_TEXT_FIELDS) {
    const value = body[field] ?? '';

    if (typeof value !== 'string') {
      throw new HttpError(
        HTTP_STATUS.BAD_REQUEST,
        'Datos de la candidatura no válidos',
      );
    }

    application[field] = value;
  }

  const status = body.status ?? 'pending';

  if (
    !isValidDate(body.appliedAt) ||
    !ALLOWED_APPLICATION_STATUSES.has(status)
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos de la candidatura no válidos',
    );
  }

  return { ...application, appliedAt: body.appliedAt, status };
};

const parseContact = body => {
  const { contact, center, contactedAt, status, notes = '' } = body;

  const hasInvalidTypes =
  typeof contact !== 'string' ||
  typeof center !== 'string' ||
  typeof notes !== 'string';

  const hasEmptyRequiredFields =
  typeof contact === 'string' &&
  !contact.trim() ||
  typeof center === 'string' &&
  !center.trim();

  if (
    hasInvalidTypes ||
    hasEmptyRequiredFields ||
    !isValidDate(contactedAt) ||
    !ALLOWED_CONTACT_STATUSES.has(status)
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos del contacto no válidos',
    );
  }

  return { contact, center, contactedAt, status, notes };
};

const createApp = ({
  dataDir = DEFAULT_DATA_DIR,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
} = {}) => {
  const app = express();
  const origins = new Set(allowedOrigins);
  const applications = createCollectionStore(
    path.join(dataDir, 'jobs.json'),
    'applications',
  );
  const contacts = createCollectionStore(
    path.join(dataDir, 'contacts.json'),
    'contacts',
  );

  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const { origin } = req.headers;

    if (origin && !origins.has(origin)) {
      res
        .status(HTTP_STATUS.FORBIDDEN)
        .json({ error: 'Origen no permitido por CORS' });
      return;
    }

    next();
  });

  app.use(cors({ origin: [...origins] }));
  app.use(express.json());
  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });

  app.get(
    '/api/applications',
    handle('No se pudo leer jobs.json', async (_req, res) => {
      res.json({ applications: await applications.list() });
    }),
  );

  app.post(
    '/api/applications',
    handle('No se pudo guardar la candidatura', async (req, res) => {
      const newApplication = parseApplication(req.body);

      await applications.update(items => {
        newApplication.id = generateId(items);
        items.push(newApplication);
      });

      res.status(HTTP_STATUS.CREATED).json(newApplication);
    }),
  );

  app.get(
    '/api/applications/old',
    handle('No se pudo leer jobs.json', async (_req, res) => {
      const items = await applications.list();

      res.json({
        applications: items.filter(item => isStalePending(item, 'appliedAt')),
      });
    }),
  );

  app.patch(
    '/api/applications/:id',
    handle('No se pudo actualizar la candidatura', async (req, res) => {
      const { status } = req.body;

      if (!ALLOWED_APPLICATION_STATUSES.has(status)) {
        throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Estado no permitido');
      }

      const application = await applications.update(items => {
        const item = findById(
          items,
          req.params.id,
          'Candidatura no encontrada',
        );

        item.status = status;

        return item;
      });

      res.json(application);
    }),
  );

  app.patch(
    '/api/applications/:id/suspend',
    handle('No se pudo suspender la candidatura', async (req, res) => {
      const application = await applications.update(items =>
        suspendIfStale(
          findById(items, req.params.id, 'Candidatura no encontrada'),
          'appliedAt',
          {
            notPending: 'La candidatura no está en espera',
            tooRecent:
              'La candidatura todavía no lleva más de 30 días en espera',
          },
        ),
      );

      res.json(application);
    }),
  );

  app.get(
    '/api/contacts',
    handle('No se pudo leer contacts.json', async (_req, res) => {
      res.json({ contacts: await contacts.list() });
    }),
  );

  app.post(
    '/api/contacts',
    handle('No se pudo guardar el contacto', async (req, res) => {
      const newContact = parseContact(req.body);

      await contacts.update(items => {
        newContact.id = generateId(items);
        items.push(newContact);
      });

      res.status(HTTP_STATUS.CREATED).json(newContact);
    }),
  );

  app.get(
    '/api/contacts/old',
    handle('No se pudo leer contacts.json', async (_req, res) => {
      const items = await contacts.list();

      res.json({
        contacts: items.filter(item => isStalePending(item, 'contactedAt')),
      });
    }),
  );

  app.patch(
    '/api/contacts/:id',
    handle('No se pudo actualizar el contacto', async (req, res) => {
      const { status, notes } = req.body;

      if (
        status !== undefined &&
        !ALLOWED_CONTACT_STATUSES.has(status)
      ) {
        throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Estado no permitido');
      }

      if (notes !== undefined && typeof notes !== 'string') {
        throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Nota no válida');
      }

      const contact = await contacts.update(items => {
        const item = findById(items, req.params.id, 'Contacto no encontrado');

        if (status !== undefined) {
          item.status = status;
        }

        if (notes !== undefined) {
          item.notes = notes;
        }

        return item;
      });

      res.json(contact);
    }),
  );

  app.patch(
    '/api/contacts/:id/suspend',
    handle('No se pudo suspender el contacto', async (req, res) => {
      const contact = await contacts.update(items =>
        suspendIfStale(
          findById(items, req.params.id, 'Contacto no encontrado'),
          'contactedAt',
          {
            notPending: 'El contacto no está en espera',
            tooRecent: 'El contacto todavía no lleva más de 30 días en espera',
          },
        ),
      );

      res.json(contact);
    }),
  );

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: 'El cuerpo de la petición no es JSON válido' });
      return;
    }

    console.info(err);
    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json({ error: 'Error interno del servidor' });
  });

  return app;
};

module.exports = { createApp, isOlderThanPendingLimit };
