const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const {
  isStaleRecord,
  parseApplication,
  parseApplicationChanges,
  suspendIfStale,
} = require('../domain/records');
const { validateApplicationTransition } = require('../domain/transitions');
const handle = require('./handle');
const { ALERTABLE_STALE_STATUSES } = require('../../../shared/constants.json');

const NOT_FOUND_MESSAGE = 'Application not found';
const APPLICATION_ALERTABLE_STATUSES = ALERTABLE_STALE_STATUSES.application;

const addApplicationRoutes = (app, storage) => {
  app.get(
    '/api/applications',
    handle('Could not retrieve applications', async (_req, res) => {
      res.json({
        applications: await storage.list('applications'),
      });
    }),
  );

  app.post(
    '/api/applications',
    handle('Could not create application', async (req, res) => {
      const application = parseApplication(req.body);
      const created = await storage.create('applications', application);

      res.status(HTTP_STATUS.CREATED).json(created);
    }),
  );

  app.get(
    '/api/applications/old',
    handle('Could not retrieve old applications', async (_req, res) => {
      const applications = await storage.list('applications');

      res.json({
        applications: applications.filter(item =>
          isStaleRecord(item, APPLICATION_ALERTABLE_STATUSES),
        ),
      });
    }),
  );

  app.patch(
    '/api/applications/:id',
    handle('Could not update application', async (req, res) => {
      const requestedChanges = req.body;

      if (
        !requestedChanges ||
        typeof requestedChanges !== 'object' ||
        Array.isArray(requestedChanges)
      ) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid request body',
          'The request body must be a valid JSON object.',
        );
      }

      if (Object.keys(requestedChanges).length === 0) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'No fields provided for update',
          'At least one field must be provided.',
        );
      }

      const currentApplication = await storage.getById('applications', req.params.id);

      if (!currentApplication) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      const changes = parseApplicationChanges(requestedChanges, currentApplication);
      if (changes.status !== undefined && changes.status !== currentApplication.status) {
        validateApplicationTransition(currentApplication.status, changes.status);
      }

      const application = await storage.update('applications', req.params.id, changes);

      if (!application) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.json(application);
    }),
  );

  app.patch(
    '/api/applications/:id/suspend',
    handle('Could not suspend application', async (req, res) => {
      const id = req.params.id;
      const application = await storage.getById('applications', id);

      if (!application) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      suspendIfStale(application, APPLICATION_ALERTABLE_STATUSES);
      validateApplicationTransition(application.status, 'suspended');

      const updated = await storage.updateIfAlertable(
        'applications',
        id,
        'appliedAt',
        application.appliedAt,
        application.history ?? [],
        APPLICATION_ALERTABLE_STATUSES,
        { status: 'suspended' },
      );

      if (!updated) {
        throw new HttpError(
          HTTP_STATUS.CONFLICT,
          'Application could not be suspended',
          'The application may have changed before the suspension was completed.',
        );
      }

      res.json(updated);
    }),
  );

  app.delete(
    '/api/applications/:id',
    handle('Could not delete application', async (req, res) => {
      const deleted = await storage.delete('applications', req.params.id);

      if (!deleted) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.status(HTTP_STATUS.NO_CONTENT).end();
    }),
  );
};

module.exports = addApplicationRoutes;
