
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { createStorage } = require('./storage');

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
  process.env.RENDER_EXTERNAL_URL,
].filter(Boolean);

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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: errorMessage,
    });
  }
};

const suspendIfStale = (record, dateField, messages) => {
  if (record.status !== 'pending') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.notPending);
  }

  if (!isOlderThanPendingLimit(record[dateField])) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.tooRecent);
  }
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

  if (
    typeof contact !== 'string' ||
    typeof center !== 'string' ||
    typeof notes !== 'string'
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos del contacto no válidos',
    );
  }

  if (
    !contact.trim() ||
    !center.trim() ||
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

const addSecurityMiddleware = (app, origins) => {
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const { origin } = req.headers;

    if (origin && !origins.has(origin)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Origen no permitido por CORS',
      });
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

const addApplicationRoutes = (app, storage) => {
  app.get(
    '/api/applications',
    handle('No se pudieron leer las candidaturas', async (_req, res) => {
      res.json({
        applications: await storage.list('applications'),
      });
    }),
  );

  app.post(
    '/api/applications',
    handle('No se pudo guardar la candidatura', async (req, res) => {
      const application = parseApplication(req.body);
      const created = await storage.create('applications', application);

      res.status(HTTP_STATUS.CREATED).json(created);
    }),
  );

  app.get(
    '/api/applications/old',
    handle(
      'No se pudieron leer las candidaturas antiguas',
      async (_req, res) => {
        const applications = await storage.list('applications');

        res.json({
          applications: applications.filter(item =>
            isStalePending(item, 'appliedAt'),
          ),
        });
      },
    ),
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

      const application = await storage.update(
        'applications',
        req.params.id,
        { status },
      );

      if (!application) {
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          NOT_FOUND_CANDIDATE_MESSAGE,
        );
      }

      res.json(application);
    }),
  );

  app.patch(
    '/api/applications/:id/suspend',
    handle('No se pudo suspender la candidatura', async (req, res) => {
      const id = req.params.id;
      const application = await storage.getById('applications', id);

      if (!application) {
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          NOT_FOUND_CANDIDATE_MESSAGE,
        );
      }

      suspendIfStale(application, 'appliedAt', {
        notPending: 'La candidatura no está en espera',
        tooRecent:
          'La candidatura todavía no lleva más de 30 días en espera',
      });

      const updated = await storage.updatePending(
        'applications',
        id,
        'appliedAt',
        application.appliedAt,
        { status: 'suspended' },
      );

      if (!updated) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'La candidatura ha cambiado y no se pudo suspender',
        );
      }

      res.json(updated);
    }),
  );
};

const addContactRoutes = (app, storage) => {
  app.get(
    '/api/contacts',
    handle('No se pudieron leer los contactos', async (_req, res) => {
      res.json({ contacts: await storage.list('contacts') });
    }),
  );

  app.post(
    '/api/contacts',
    handle('No se pudo guardar el contacto', async (req, res) => {
      const contact = parseContact(req.body);
      const created = await storage.create('contacts', contact);

      res.status(HTTP_STATUS.CREATED).json(created);
    }),
  );

  app.get(
    '/api/contacts/old',
    handle(
      'No se pudieron leer los contactos antiguos',
      async (_req, res) => {
        const contacts = await storage.list('contacts');

        res.json({
          contacts: contacts.filter(item =>
            isStalePending(item, 'contactedAt'),
          ),
        });
      },
    ),
  );

  app.patch(
    '/api/contacts/:id',
    handle('No se pudo actualizar el contacto', async (req, res) => {
      const { status, notes } = req.body;
      const changes = {};

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

      if (status !== undefined) {
        changes.status = status;
      }
      if (notes !== undefined) {
        changes.notes = notes;
      }

      let contact;

      if (Object.keys(changes).length > 0) {
        contact = await storage.update('contacts', req.params.id, changes);
      } else {
        contact = await storage.getById('contacts', req.params.id);
      }

      if (!contact) {
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          NOT_FOUND_CONTACT_MESSAGE,
        );
      }

      res.json(contact);
    }),
  );

  app.patch(
    '/api/contacts/:id/suspend',
    handle('No se pudo suspender el contacto', async (req, res) => {
      const id = req.params.id;
      const contact = await storage.getById('contacts', id);

      if (!contact) {
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          NOT_FOUND_CONTACT_MESSAGE,
        );
      }

      suspendIfStale(contact, 'contactedAt', {
        notPending: 'El contacto no está en espera',
        tooRecent:
          'El contacto todavía no lleva más de 30 días en espera',
      });

      const updated = await storage.updatePending(
        'contacts',
        id,
        'contactedAt',
        contact.contactedAt,
        { status: 'suspended' },
      );

      if (!updated) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'El contacto ha cambiado y no se pudo suspender',
        );
      }

      res.json(updated);
    }),
  );
};

const createApp = ({
  storage: injectedStorage,
  allowedOrigins = DEFAULT_ALLOWED_ORIGINS,
} = {}) => {
  const app = express();
  const storage = injectedStorage || createStorage();
  const origins = new Set(allowedOrigins);

  addSecurityMiddleware(app, origins);
  addApplicationRoutes(app, storage);
  addContactRoutes(app, storage);

  const clientDistPath = path.resolve(__dirname, '../client/dist');

  app.use(express.static(clientDistPath));

  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(clientDistPath, 'index.html'), error => {
      if (error) {
        next(error);
      }
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'El cuerpo de la petición no es JSON válido',
      });
      return;
    }

    console.info(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Error interno del servidor',
    });
  });

  return app;
};

module.exports = { createApp, isOlderThanPendingLimit };
