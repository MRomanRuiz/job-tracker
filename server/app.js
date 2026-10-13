const express = require('express');
const cors = require('cors');
const { getDB } = require('./db');

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

const NOT_FOUND_CANDIDATE_MESSAGE = 'Candidatura no encontrada';
const NOT_FOUND_CONTACT_MESSAGE = 'Contacto no encontrado';

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
  record.status === 'pending' &&
  isOlderThanPendingLimit(record[dateField]);

const isValidDate = value => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

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

  return {
    ...application,
    appliedAt: body.appliedAt,
    status,
  };
};

const parseContact = body => {
  const { contact, center, contactedAt, status, notes = '' } = body;

  const hasInvalidTypes =
    typeof contact !== 'string' ||
    typeof center !== 'string' ||
    typeof notes !== 'string';

  const hasEmptyRequiredFields =
    (typeof contact === 'string' && !contact.trim()) ||
    (typeof center === 'string' && !center.trim());

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

const publicRecord = record => {
  if (!record) {
    return record;
  }

  const data = { ...record };
  delete data._id;

  return data;
};

const generateId = async (db, collectionName) => {
  const collection = db.collection(collectionName);

  const lastRecord = await collection
    .find({})
    .sort({ id: -1 })
    .project({ _id: 0, id: 1 })
    .limit(1)
    .next();

  const maxExistingId = Number(lastRecord?.id) || 0;
  const counters = db.collection('_counters');

  await counters.updateOne(
    { _id: collectionName },
    { $max: { seq: maxExistingId } },
    { upsert: true },
  );

  const result = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  const counter = result?.value ?? result;

  return counter.seq;
};

const findRecordById = async (collection, id, notFoundMessage) => {
  const record = await collection.findOne(
    { id: Number(id) },
    { projection: { _id: 0 } },
  );

  if (!record) {
    throw new HttpError(HTTP_STATUS.NOT_FOUND, notFoundMessage);
  }

  return record;
};

const addSecurityMiddleware = (app, origins) => {
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
};

const addApplicationRoutes = (app, database) => {
  app.get(
    '/api/applications',
    handle('No se pudieron leer las candidaturas', async (_req, res) => {
      const applications = await database()
        .collection('applications')
        .find({}, { projection: { _id: 0 } })
        .toArray();

      res.json({ applications });
    }),
  );

  app.post(
    '/api/applications',
    handle('No se pudo guardar la candidatura', async (req, res) => {
      const db = database();
      const newApplication = parseApplication(req.body);

      newApplication.id = await generateId(db, 'applications');

      await db.collection('applications').insertOne(newApplication);

      res.status(HTTP_STATUS.CREATED).json(publicRecord(newApplication));
    }),
  );

  app.get(
    '/api/applications/old',
    handle('No se pudieron leer las candidaturas antiguas', async (_req, res) => {
      const applications = await database()
        .collection('applications')
        .find(
          { status: 'pending' },
          { projection: { _id: 0 } },
        )
        .toArray();

      res.json({
        applications: applications.filter(item =>
          isStalePending(item, 'appliedAt'),
        ),
      });
    }),
  );

  app.patch(
    '/api/applications/:id',
    handle('No se pudo actualizar la candidatura', async (req, res) => {
      const { status } = req.body;

      if (!ALLOWED_APPLICATION_STATUSES.has(status)) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Estado no permitido',
        );
      }

      const collection = database().collection('applications');
      const id = Number(req.params.id);

      const result = await collection.updateOne(
        { id },
        { $set: { status } },
      );

      if (result.matchedCount === 0) {
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          NOT_FOUND_CANDIDATE_MESSAGE,
        );
      }

      const application = await findRecordById(
        collection,
        id,
        NOT_FOUND_CANDIDATE_MESSAGE,
      );

      res.json(application);
    }),
  );

  app.patch(
    '/api/applications/:id/suspend',
    handle('No se pudo suspender la candidatura', async (req, res) => {
      const collection = database().collection('applications');
      const id = Number(req.params.id);

      const application = await findRecordById(
        collection,
        id,
        NOT_FOUND_CANDIDATE_MESSAGE,
      );

      suspendIfStale(application, 'appliedAt', {
        notPending: 'La candidatura no está en espera',
        tooRecent:
          'La candidatura todavía no lleva más de 30 días en espera',
      });

      const result = await collection.updateOne(
        {
          id,
          status: 'pending',
          appliedAt: application.appliedAt,
        },
        { $set: { status: 'suspended' } },
      );

      if (result.matchedCount === 0) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'La candidatura ha cambiado y no se pudo suspender',
        );
      }

      res.json(application);
    }),
  );
};

const addContactRoutes = (app, database) => {
  app.get(
    '/api/contacts',
    handle('No se pudieron leer los contactos', async (_req, res) => {
      const contacts = await database()
        .collection('contacts')
        .find({}, { projection: { _id: 0 } })
        .toArray();

      res.json({ contacts });
    }),
  );

  app.post(
    '/api/contacts',
    handle('No se pudo guardar el contacto', async (req, res) => {
      const db = database();
      const newContact = parseContact(req.body);

      newContact.id = await generateId(db, 'contacts');

      await db.collection('contacts').insertOne(newContact);

      res.status(HTTP_STATUS.CREATED).json(publicRecord(newContact));
    }),
  );

  app.get(
    '/api/contacts/old',
    handle('No se pudieron leer los contactos antiguos', async (_req, res) => {
      const contacts = await database()
        .collection('contacts')
        .find(
          { status: 'pending' },
          { projection: { _id: 0 } },
        )
        .toArray();

      res.json({
        contacts: contacts.filter(item =>
          isStalePending(item, 'contactedAt'),
        ),
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
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Estado no permitido',
        );
      }

      if (notes !== undefined && typeof notes !== 'string') {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Nota no válida',
        );
      }

      const collection = database().collection('contacts');
      const id = Number(req.params.id);
      const updates = {};

      if (status !== undefined) {
        updates.status = status;
      }

      if (notes !== undefined) {
        updates.notes = notes;
      }

      if (Object.keys(updates).length > 0) {
        const result = await collection.updateOne(
          { id },
          { $set: updates },
        );

        if (result.matchedCount === 0) {
          throw new HttpError(
            HTTP_STATUS.NOT_FOUND,
            NOT_FOUND_CONTACT_MESSAGE,
          );
        }
      }

      const contact = await findRecordById(
        collection,
        id,
        NOT_FOUND_CONTACT_MESSAGE,
      );

      res.json(contact);
    }),
  );

  app.patch(
    '/api/contacts/:id/suspend',
    handle('No se pudo suspender el contacto', async (req, res) => {
      const collection = database().collection('contacts');
      const id = Number(req.params.id);

      const contact = await findRecordById(
        collection,
        id,
        NOT_FOUND_CONTACT_MESSAGE,
      );

      suspendIfStale(contact, 'contactedAt', {
        notPending: 'El contacto no está en espera',
        tooRecent: 'El contacto todavía no lleva más de 30 días en espera',
      });

      const result = await collection.updateOne(
        {
          id,
          status: 'pending',
          contactedAt: contact.contactedAt,
        },
        { $set: { status: 'suspended' } },
      );

      if (result.matchedCount === 0) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'El contacto ha cambiado y no se pudo suspender',
        );
      }

      res.json(contact);
    }),
  );
};

const createApp = ({
  db: injectedDB,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
} = {}) => {
  const app = express();
  const origins = new Set(allowedOrigins);
  const database = () => injectedDB || getDB();

  addSecurityMiddleware(app, origins);
  addApplicationRoutes(app, database);
  addContactRoutes(app, database);

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
