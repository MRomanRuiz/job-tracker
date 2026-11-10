const { HTTP_STATUS, HttpError } = require('../domain/httpError');
const {
  isStalePending,
  parseContact,
  parseContactChanges,
  suspendIfStale,
} = require('../domain/records');
const handle = require('./handle');

const NOT_FOUND_MESSAGE = 'Contact not found';

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
        contacts: contacts.filter(item => isStalePending(item, 'contactedAt')),
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

      const changes = parseContactChanges(requestedChanges);
      const contact = await storage.update('contacts', req.params.id, changes);

      if (!contact) {
        throw new HttpError(HTTP_STATUS.NOT_FOUND, NOT_FOUND_MESSAGE);
      }

      res.json(contact);
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

      suspendIfStale(contact, 'contactedAt');

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
