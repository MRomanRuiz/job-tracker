const { HTTP_STATUS, HttpError, serializeError } = require('../domain/httpError');

const handle = (fallbackDescription, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (res.headersSent) {
      throw err;
    }

    if (err instanceof HttpError) {
      res.status(err.statusCode).json(serializeError(err));
      return;
    }

    console.info(err);

    res
      .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(serializeError({ message: 'Internal server error' }, fallbackDescription));
  }
};

module.exports = handle;
