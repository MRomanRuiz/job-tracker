const HTTP_STATUS = {
  BAD_REQUEST: 400,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NOT_FOUND: 404,
  NO_CONTENT: 204,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
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

module.exports = { HTTP_STATUS, HttpError };
