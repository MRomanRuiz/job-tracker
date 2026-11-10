const { HTTP_STATUS } = require('../domain/httpError');

// Express error middleware requires all four parameters.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  // Invalid JSON
  if (err.type === 'entity.parse.failed') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: 'Invalid JSON',
      description: 'The request body contains malformed JSON.',
    });
    return;
  }

  if (err.type === 'entity.too.large') {
    res.status(HTTP_STATUS.PAYLOAD_TOO_LARGE).json({
      message: 'Payload too large',
      description: 'The request body exceeds the allowed size.',
    });
    return;
  }

  // Known application errors
  if (
    Number.isInteger(err.statusCode) &&
    err.statusCode >= HTTP_STATUS.BAD_REQUEST &&
    err.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR
  ) {
    res.status(err.statusCode).json({
      message: err.message,
      ...(err.description && {
        description: err.description,
      }),
      ...(err.details?.length > 0 && {
        details: err.details,
      }),
    });
    return;
  }

  // Unexpected server errors
  console.info(err);

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    message: 'Internal server error',
    description: 'An unexpected error occurred while processing the request.',
  });
};

module.exports = errorHandler;
