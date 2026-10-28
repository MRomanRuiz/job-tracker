const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const {
  isStalePending,
  parseApplication,
  parseApplicationChanges,
  suspendIfStale,
} = require('../domain/records');
const handle = require('./handle');

const NOT_FOUND_MESSAGE = 'Candidatura no encontrada';
const APPLICATION_UPDATE_FIELDS = new Set([
  'status',
  'notes',
  'company',
  'position',
  'type',
  'city',
  'country',
  'durationType',
  'durationMonths',
  'appliedAt',
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

const validateApplicationChanges = body => {
  validateAllowedFields(body, APPLICATION_UPDATE_FIELDS);

  if (Object.keys(body).length === 0) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'No se han proporcionado campos para actualizar');
  }

  return body;
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
    handle('No se pudieron leer las candidaturas antiguas', async (_req, res) => {
      const applications = await storage.list('applications');

      res.json({
        applications: applications.filter(item => isStalePending(item, 'appliedAt')),
      });
    }),
  );

  app.patch(
    '/api/applications/:id',
    handle('No se pudo actualizar la candidatura', async (req, res) => {
      const requestedChanges = validateApplicationChanges(req.body);
      const requiresCurrentApplication = Object.keys(requestedChanges).some(
        field => !['status', 'notes'].includes(field),
      );
      const currentApplication = requiresCurrentApplication
        ? await storage.getById('applications', req.params.id)
        : {};

      if (requiresCurrentApplication && !currentApplication) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      const changes = parseApplicationChanges(requestedChanges, currentApplication);
      const application = await storage.update('applications', req.params.id, changes);

      if (!application) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
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
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      suspendIfStale(application, 'appliedAt', {
        notPending: 'La candidatura no está en espera',
        tooRecent: 'La candidatura todavía no lleva más de 30 días en espera',
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

  app.delete(
    '/api/applications/:id',
    handle('No se pudo eliminar la candidatura', async (req, res) => {
      const deleted = await storage.delete('applications', req.params.id);

      if (!deleted) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.status(HTTP_STATUS.NO_CONTENT).end();
    }),
  );
};

module.exports = addApplicationRoutes;
