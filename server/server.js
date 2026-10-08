const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const PORT = 3001;
const HTTP_STATUS = {
  INTERNAL_SERVER_ERROR: 500,
  CREATED: 201,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
};
const LABEL_CANT_READ = 'No se pudo leer jobs.json';
const LABEL_FORBIDDEN_STATE = 'Estado no permitido';

const MAX_PENDING_DAYS = 30;
const ALLOWED_MANUAL_STATUSES = new Set([
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

app.disable('x-powered-by');
app.use(express.json());

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origen no permitido por CORS'));
      }
    },
  }),
);

const jobsDataFile = path.join(
  __dirname,
  '..',
  'client',
  'src',
  'data',
  'jobs.json',
);

const contactsDataFile = path.join(
  __dirname,
  '..',
  'client',
  'src',
  'data',
  'contacts.json',
);

const isOlderThanPendingLimit = appliedAt => {
  const appliedDate = new Date(appliedAt);

  if (Number.isNaN(appliedDate.getTime())) {
    return false;
  }

  const now = new Date();
  const ageInDays =
    (now - appliedDate) / (1000 * 60 * 60 * 24);

  return ageInDays > MAX_PENDING_DAYS;
};

const isOlderThanContactPendingLimit = contactedAt => {
  const contactedDate = new Date(contactedAt);

  if (Number.isNaN(contactedDate.getTime())) {
    return false;
  }

  const now = new Date();
  const ageInDays =
    (now - contactedDate) / (1000 * 60 * 60 * 24);

  return ageInDays > MAX_PENDING_DAYS;
};

app.get('/api/applications', (_req, res) => {
  fs.readFile(jobsDataFile, 'utf8', (err, data) => {
    if (err) {
      console.info(err);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: LABEL_CANT_READ,
      });
    }

    return res.json(JSON.parse(data));
  });
});

app.patch('/api/applications/:id', async (req, res) => {
  try {
    const data = await fs.promises.readFile(jobsDataFile, 'utf8');
    const jobsData = JSON.parse(data);

    const application = jobsData.applications.find(
      job => job.id === Number(req.params.id),
    );

    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Candidatura no encontrada',
      });
    }

    const { status } = req.body;

    if (!ALLOWED_MANUAL_STATUSES.has(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: LABEL_FORBIDDEN_STATE,
      });
    }

    application.status = status;

    await fs.promises.writeFile(
      jobsDataFile,
      JSON.stringify(jobsData, null, 2),
      'utf8',
    );

    return res.json(application);
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: LABEL_CANT_READ,
    });
  }
});

app.post('/api/applications', (req, res) => {
  fs.readFile(jobsDataFile, 'utf8', (err, data) => {
    if (err) {
      console.info(err);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: LABEL_CANT_READ,
      });
    }

    const jobsData = JSON.parse(data);

    const newApplication = {
      id: Date.now(),
      ...req.body,
    };

    jobsData.applications.push(newApplication);

    return fs.writeFile(
      jobsDataFile,
      JSON.stringify(jobsData, null, 2),
      'utf8',
      error => {
        if (error) {
          console.info(error);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: 'No se pudo guardar la candidatura',
          });
        }

        return res.status(HTTP_STATUS.CREATED).json(newApplication);
      },
    );
  });
});

app.get('/api/applications/old', async (_req, res) => {
  try {
    const data = await fs.promises.readFile(jobsDataFile, 'utf8');
    const jobsData = JSON.parse(data);

    const oldApplications = jobsData.applications.filter(
      application =>
        application.status === 'pending' &&
        isOlderThanPendingLimit(application.appliedAt),
    );

    return res.json({
      applications: oldApplications,
    });
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: LABEL_CANT_READ,
    });
  }
});

app.patch('/api/applications/:id/suspend', async (req, res) => {
  try {
    const data = await fs.promises.readFile(jobsDataFile, 'utf8');
    const jobsData = JSON.parse(data);

    const application = jobsData.applications.find(
      job => job.id === Number(req.params.id),
    );

    if (!application) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Candidatura no encontrada',
      });
    }

    if (application.status !== 'pending') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'La candidatura no está en espera',
      });
    }

    if (!isOlderThanPendingLimit(application.appliedAt)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'La candidatura todavía no lleva más de 30 días en espera',
      });
    }

    application.status = 'suspended';

    await fs.promises.writeFile(
      jobsDataFile,
      JSON.stringify(jobsData, null, 2),
      'utf8',
    );

    return res.json(application);
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'No se pudo suspender la candidatura',
    });
  }
});

app.get('/api/contacts', async (_req, res) => {
  try {
    const data = await fs.promises.readFile(
      contactsDataFile,
      'utf8',
    );

    const contactsData = JSON.parse(data);

    return res.json(contactsData.contacts);
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'No se pudo leer contacts.json',
    });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const data = await fs.promises.readFile(
      contactsDataFile,
      'utf8',
    );

    const contactsData = JSON.parse(data);

    const {
      contact,
      center,
      contactedAt,
      status,
      notes,
    } = req.body;

    if (
      !contact ||
      !center ||
      !contactedAt ||
      !ALLOWED_CONTACT_STATUSES.has(status)
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Datos del contacto no válidos',
      });
    }

    const newContact = {
      contact,
      center,
      contactedAt,
      status,
      id: Date.now(),
      notes: notes || '',
    };

    contactsData.contacts.push(newContact);

    await fs.promises.writeFile(
      contactsDataFile,
      JSON.stringify(contactsData, null, 2),
      'utf8',
    );

    return res
      .status(HTTP_STATUS.CREATED)
      .json(newContact);
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'No se pudo guardar el contacto',
    });
  }
});

app.get('/api/contacts/old', async (_req, res) => {
  try {
    const data = await fs.promises.readFile(
      contactsDataFile,
      'utf8',
    );

    const contactsData = JSON.parse(data);

    const oldContacts = contactsData.contacts.filter(
      contact =>
        contact.status === 'pending' &&
        isOlderThanContactPendingLimit(
          contact.contactedAt,
        ),
    );

    return res.json({
      contacts: oldContacts,
    });
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'No se pudo leer contacts.json',
    });
  }
});

app.patch('/api/contacts/:id', async (req, res) => {
  try {
    const data = await fs.promises.readFile(
      contactsDataFile,
      'utf8',
    );

    const contactsData = JSON.parse(data);

    const contact = contactsData.contacts.find(
      item => item.id === Number(req.params.id),
    );

    if (!contact) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Contacto no encontrado',
      });
    }

    const { status, notes } = req.body;

    if (
      status !== undefined &&
      !ALLOWED_CONTACT_STATUSES.has(status)
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: LABEL_FORBIDDEN_STATE,
      });
    }

    if (status !== undefined) {
      contact.status = status;
    }

    if (notes !== undefined) {
      contact.notes = notes;
    }

    await fs.promises.writeFile(
      contactsDataFile,
      JSON.stringify(contactsData, null, 2),
      'utf8',
    );

    return res.json(contact);
  } catch (err) {
    console.info(err);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'No se pudo actualizar el contacto',
    });
  }
});

app.listen(PORT, () => {
  console.info(`Servidor funcionando en http://localhost:${PORT}`);
});
