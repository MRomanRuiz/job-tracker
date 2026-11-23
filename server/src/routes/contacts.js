const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const {
  isStaleRecord,
  parseContact,
  parseContactChanges,
  suspendIfStale,
} = require('../domain/records');
const handle = require('./handle');
const { CONTACT_TRANSITIONS, validateContactTransition } = require('../domain/transitions');
const { RECORD_STATUSES } = require('../../../shared/constants.json');

const NOT_FOUND_MESSAGE = 'Contact not found';
const CONTACT_ALERT_STATUSES = ['pending', 'in_conversation'];
const FINAL_CONTACT_STATUSES = new Set(
  Object.entries(CONTACT_TRANSITIONS)
    .filter(([, nextStatuses]) => nextStatuses.length === 0)
    .map(([status]) => status),
);
const CONTACT_ALERTABLE_STATUSES = CONTACT_ALERT_STATUSES.filter(
  status =>
    Object.hasOwn(CONTACT_TRANSITIONS, status) &&
    status !== RECORD_STATUSES.suspended &&
    status !== 'follow_up' &&
    !FINAL_CONTACT_STATUSES.has(status),
);

const addContactRoutes = (app, storage) => {
  app.get(
    '/api/contacts',
    handle('Could not retrieve contacts', async (_req, res) => {
      res.json({
        contacts: await storage.list('contacts'),
      });
    }),
  );

  app.post(
    '/api/contacts',
    handle('Could not create contact', async (req, res) => {
      const contact = parseContact(req.body);
      const created = await storage.create('contacts', contact);

      res.status(HTTP_STATUS.CREATED).json(created);
    }),
  );

  app.get(
    '/api/contacts/old',
    handle('Could not retrieve old contacts', async (_req, res) => {
      const contacts = await storage.list('contacts');

      res.json({
        contacts: contacts.filter(item => isStaleRecord(item, CONTACT_ALERTABLE_STATUSES)),
      });
    }),
  );

  app.patch(
    '/api/contacts/:id',
    handle('Could not update contact', async (req, res) => {
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

      const currentContact = await storage.getById('contacts', req.params.id);

      if (!currentContact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      const changes = parseContactChanges(requestedChanges, currentContact);

      if (changes.status !== undefined && changes.status !== currentContact.status) {
        validateContactTransition(currentContact.status, changes.status);
      }

      const updated = await storage.update('contacts', req.params.id, changes);

      if (!updated) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.json(updated);
    }),
  );

  app.patch(
    '/api/contacts/:id/suspend',
    handle('Could not suspend contact', async (req, res) => {
      const id = req.params.id;
      const contact = await storage.getById('contacts', id);

      if (!contact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      suspendIfStale(contact, CONTACT_ALERTABLE_STATUSES);
      validateContactTransition(contact.status, 'suspended');

      const updated = await storage.updateIfAlertable(
        'contacts',
        id,
        'contactedAt',
        contact.contactedAt,
        contact.history ?? [],
        CONTACT_ALERTABLE_STATUSES,
        { status: 'suspended' },
      );

      if (!updated) {
        throw new HttpError(
          HTTP_STATUS.CONFLICT,
          'Contact could not be suspended',
          'The contact may have changed before the suspension was completed.',
        );
      }

      res.json(updated);
    }),
  );

  app.delete(
    '/api/contacts/:id',
    handle('Could not delete contact', async (req, res) => {
      const deleted = await storage.delete('contacts', req.params.id);

      if (!deleted) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.status(HTTP_STATUS.NO_CONTENT).end();
    }),
  );
};

module.exports = addContactRoutes;
