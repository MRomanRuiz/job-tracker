const { HTTP_STATUS, HttpError } = require('../domain/httpError');

const handle = (errorMessage, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (res.headersSent) {
      throw err;
    }

    if (err instanceof HttpError) {
      const response = {
        message: err.message,
      };

      if (err.description) {
        response.description = err.description;
      }

      if (err.details?.length > 0) {
        response.details = err.details;
      }

      res.status(err.statusCode).json(response);
      return;
    }

    console.info(err);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
      description: errorMessage,
    });
  }
};

module.exports = handle;
