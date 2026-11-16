const { HTTP_STATUS } = require('../../../shared/constants.json');

const serializeError = (error, fallbackDescription) => {
  const description = error.description || fallbackDescription;

  return {
    message: error.message,
    ...(description && { description }),
    ...(error.details?.length > 0 && {
      details: error.details,
    }),
  };
};

class HttpError extends Error {
  constructor(statusCode, message, description = null, details = []) {
    super(message);

    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.description = description;
    this.details = details;
  }
}

module.exports = { HTTP_STATUS, HttpError, serializeError };
