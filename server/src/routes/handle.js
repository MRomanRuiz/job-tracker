const { HTTP_STATUS, HttpError } = require('../domain/httpError');

const handle = (errorMessage, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }

    console.info(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: errorMessage,
    });
  }
};

module.exports = handle;
