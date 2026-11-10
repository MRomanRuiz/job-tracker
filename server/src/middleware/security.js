const cors = require('cors');
const express = require('express');
const { HTTP_STATUS, HttpError } = require('../domain/httpError');

const addSecurityMiddleware = (app, origins) => {
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const { origin } = req.headers;

    if (origin && !origins.has(origin)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        message: 'Origin not allowed',
        description: 'The request origin is not included in the allowed origins.',
      });
    }

    return next();
  });

  app.use(cors({ origin: [...origins] }));
  app.use(express.json());

  app.use((req, _res, next) => {
    req.body ??= {};
    return next();
  });
};

module.exports = addSecurityMiddleware;
