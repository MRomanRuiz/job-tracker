const express = require('express');
const path = require('node:path');
const { createStorage } = require('./storage');
const errorHandler = require('./middleware/errorHandler');
const addSecurityMiddleware = require('./middleware/security');
const addApplicationRoutes = require('./routes/applications');
const addContactRoutes = require('./routes/contacts');
const { isOlderThanPendingLimit } = require('./domain/records');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.RENDER_EXTERNAL_URL,
].filter(Boolean);

const createApp = ({ storage: injectedStorage, allowedOrigins = DEFAULT_ALLOWED_ORIGINS } = {}) => {
  const app = express();
  const storage = injectedStorage ?? createStorage();
  const origins = new Set(allowedOrigins);

  addSecurityMiddleware(app, origins);
  addApplicationRoutes(app, storage);
  addContactRoutes(app, storage);

  const clientDistPath = path.resolve(__dirname, '../../client/dist');

  app.use(express.static(clientDistPath));

  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(clientDistPath, 'index.html'), error => {
      if (error) {
        next(new Error('Could not serve the client application.', { cause: error }));
      }
    });
  });

  app.use(errorHandler);

  return app;
};

module.exports = { createApp, isOlderThanPendingLimit };
