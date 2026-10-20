const { HTTP_STATUS } = require('../domain/httpError');

// Express error middleware requires all four parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'El cuerpo de la petición no es JSON válido',
    });
    return;
  }

  console.info(err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    error: 'Error interno del servidor',
  });
};

module.exports = errorHandler;
