const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const { parseContact, parseContactChanges, suspendIfStale } = require('../domain/records');
const handle = require('./handle');
const { CONTACT_TRANSITIONS, validateContactTransition } = require('../domain/transitions');
const { RECORD_STATUSES } = require('../../../shared/constants.json');

const ENDPOINT_ID = '/api/contacts/:id';
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
    handle('Could not retrieve contacts', async (req, res) => {
      const contacts = await storage.list('contacts');

      if (req.query.ids === undefined) {
        return res.json({ contacts });
      }

      if (typeof req.query.ids !== 'string' || !req.query.ids.trim()) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid contact IDs',
          'The ids query parameter must contain one or more IDs.',
        );
      }

      const ids = [...new Set(req.query.ids.split(',').map(id => id.trim()))];

      if (ids.some(id => !id)) {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          'Invalid contact IDs',
          'The ids query parameter must contain valid IDs.',
        );
      }

      const requestedIds = new Set(ids);

      return res.json({
        contacts: contacts.filter(contact => requestedIds.has(String(contact.id))),
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
    ENDPOINT_ID,
    handle('Could not retrieve contact', async (req, res) => {
      const contact = await storage.getById('contacts', req.params.id);

      if (!contact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.json(contact);
    }),
  );

  app.patch(
    ENDPOINT_ID,
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

      if (
        requestedChanges.status !== undefined &&
        requestedChanges.status !== currentContact.status
      ) {
        validateContactTransition(currentContact.status, requestedChanges.status);
      }

      const changes = parseContactChanges(requestedChanges, currentContact);

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
    ENDPOINT_ID,
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
