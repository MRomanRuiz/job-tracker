const { isStaleRecord, isScheduledRecord } = require('../domain/records');
const handle = require('./handle');
const { ALERTABLE_STATUSES } = require('../../../shared/constants.json');
const CONTACT_SCHEDULED_STATUSES = new Set(['follow_up']);
const APPLICATION_SCHEDULED_STATUSES = new Set(['interview']);

const addAlertsRoutes = (app, storage) => {
  app.get(
    '/api/alerts',
    handle('Could not retrieve alerts', async (_req, res) => {
      const [contacts, applications] = await Promise.all([
        storage.list('contacts'),
        storage.list('applications'),
      ]);

      const alerts = [];

      for (const contact of contacts) {
        if (isStaleRecord(contact, ALERTABLE_STATUSES.contact)) {
          alerts.push({
            type: 'stale',
            entity: 'contact',
            recordId: String(contact.id),
          });
        }

        if (CONTACT_SCHEDULED_STATUSES.has(contact.status) && isScheduledRecord(contact)) {
          alerts.push({
            type: 'scheduled',
            entity: 'contact',
            recordId: String(contact.id),
          });
        }
      }

      for (const application of applications) {
        if (isStaleRecord(application, ALERTABLE_STATUSES.application)) {
          alerts.push({
            type: 'stale',
            entity: 'application',
            recordId: String(application.id),
          });
        }

        if (
          APPLICATION_SCHEDULED_STATUSES.has(application.status) &&
          isScheduledRecord(application)
        ) {
          alerts.push({
            type: 'scheduled',
            entity: 'application',
            recordId: String(application.id),
          });
        }
      }

      res.json({ alerts });
    }),
  );
};

module.exports = addAlertsRoutes;
