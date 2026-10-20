const cors = require('cors');
const express = require('express');
const { HTTP_STATUS } = require('../domain/httpError');

const addSecurityMiddleware = (app, origins) => {
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const { origin } = req.headers;

    if (origin && !origins.has(origin)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Origen no permitido por CORS',
      });
      return;
    }

    next();
  });

  app.use(cors({ origin: [...origins] }));
  app.use(express.json());

  app.use((req, _res, next) => {
    req.body ??= {};
    next();
  });
};

module.exports = addSecurityMiddleware;
