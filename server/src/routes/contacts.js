const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const {
  ALLOWED_CONTACT_STATUSES,
  isStalePending,
  parseContact,
  parseContactChanges,
  suspendIfStale,
} = require('../domain/records');
const handle = require('./handle');

const CONTACT_UPDATE_FIELDS = new Set(['status', 'notes']);

const NOT_FOUND_MESSAGE = 'Contacto no encontrado';
const CONTACT_DETAIL_FIELDS = new Set([
  'status',
  'notes',
  'contact',
  'email',
  'institution',
  'department',
  'city',
  'country',
  'contactedAt',
]);

const validateAllowedFields = (body, allowedFields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Cuerpo de la solicitud no válido');
  }

  const invalidFields = Object.keys(body).filter(field => !allowedFields.has(field));

  if (invalidFields.length > 0) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, `Campos no válidos: ${invalidFields.join(', ')}`);
  }
};

const validateContactChanges = body => {
  validateAllowedFields(body, CONTACT_UPDATE_FIELDS);

  const { status, notes } = body;

  if (status === undefined && notes === undefined) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'No se han proporcionado campos para actualizar');
  }

  if (status !== undefined && !ALLOWED_CONTACT_STATUSES.has(status)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Estado no permitido');
  }

  if (notes !== undefined && typeof notes !== 'string') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Nota no válida');
  }

  return {
    ...(status !== undefined && { status }),
    ...(notes !== undefined && { notes }),
  };
};

const validateContactDetails = body => {
  validateAllowedFields(body, CONTACT_DETAIL_FIELDS);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'El cuerpo de la petición no es válido');
  }

  const entries = Object.entries(body);
  if (entries.length === 0) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'No se han proporcionado campos para actualizar');
  }

  return parseContactChanges(body);
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
    handle('No se pudieron leer los contactos antiguos', async (_req, res) => {
      const contacts = await storage.list('contacts');

      res.json({
        contacts: contacts.filter(item => isStalePending(item, 'contactedAt')),
      });
    }),
  );

  app.patch(
    '/api/contacts/:id',
    handle('No se pudo actualizar el contacto', async (req, res) => {
      const changes = validateContactChanges(req.body);
      const contact = await storage.update('contacts', req.params.id, changes);

      if (!contact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.json(contact);
    }),
  );

  app.patch(
    '/api/contacts/:id/details',
    handle('No se pudieron actualizar los detalles del contacto', async (req, res) => {
      const changes = validateContactDetails(req.body);
      const contact = await storage.update('contacts', req.params.id, changes);

      if (!contact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
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
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      suspendIfStale(contact, 'contactedAt', {
        notPending: 'El contacto no está en espera',
        tooRecent: 'El contacto todavía no lleva más de 30 días en espera',
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

  app.delete(
    '/api/contacts/:id',
    handle('No se pudo eliminar el contacto', async (req, res) => {
      const deleted = await storage.delete('contacts', req.params.id);

      if (!deleted) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.status(HTTP_STATUS.NO_CONTENT).end();
    }),
  );
};

module.exports = addContactRoutes;
