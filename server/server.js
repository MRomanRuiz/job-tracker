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

const MAX_PENDING_DAYS = 30;
const ALLOWED_MANUAL_STATUSES = new Set([
  'pending',
  'interview',
  'offer',
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

const dataFile = path.join(
  __dirname,
  '..',
  'client',
  'src',
  'data',
  'jobs.json',
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

app.get('/api/applications', (_req, res) => {
  fs.readFile(dataFile, 'utf8', (err, data) => {
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
    const data = await fs.promises.readFile(dataFile, 'utf8');
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
        error: 'Estado no permitido',
      });
    }

    application.status = status;

    await fs.promises.writeFile(
      dataFile,
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
  fs.readFile(dataFile, 'utf8', (err, data) => {
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
      dataFile,
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
    const data = await fs.promises.readFile(dataFile, 'utf8');
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
    const data = await fs.promises.readFile(dataFile, 'utf8');
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
      dataFile,
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

app.listen(PORT, () => {
  console.info(`Servidor funcionando en http://localhost:${PORT}`);
});
