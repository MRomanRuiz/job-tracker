const { HTTP_STATUS, HttpError } = require('./httpError');

const MAX_PENDING_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALLOWED_APPLICATION_STATUSES = new Set([
  'pending',
  'interview',
  'offer',
  'rejected',
]);

const ALLOWED_CONTACT_STATUSES = new Set([
  'pending',
  'replied',
  'rejected',
]);

const APPLICATION_TEXT_FIELDS = [
  'company',
  'position',
  'location',
  'type',
];

const isOlderThanPendingLimit = (date, now = new Date()) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return (now - parsedDate) / MS_PER_DAY > MAX_PENDING_DAYS;
};

const isStalePending = (record, dateField) =>
  record.status === 'pending' &&
  isOlderThanPendingLimit(record[dateField]);

const isValidDate = value => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(value);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const suspendIfStale = (record, dateField, messages) => {
  if (record.status !== 'pending') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.notPending);
  }

  if (!isOlderThanPendingLimit(record[dateField])) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, messages.tooRecent);
  }
};

const parseApplication = body => {
  const application = {};

  for (const field of APPLICATION_TEXT_FIELDS) {
    const value = body[field] ?? '';

    if (typeof value !== 'string') {
      throw new HttpError(
        HTTP_STATUS.BAD_REQUEST,
        'Datos de la candidatura no válidos',
      );
    }

    application[field] = value;
  }

  const status = body.status ?? 'pending';

  if (
    !isValidDate(body.appliedAt) ||
    !ALLOWED_APPLICATION_STATUSES.has(status)
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos de la candidatura no válidos',
    );
  }

  return {
    ...application,
    appliedAt: body.appliedAt,
    status,
  };
};

const parseContact = body => {
  const { contact, center, contactedAt, status, notes = '' } = body;

  if (
    typeof contact !== 'string' ||
    typeof center !== 'string' ||
    typeof notes !== 'string'
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos del contacto no válidos',
    );
  }

  if (
    !contact.trim() ||
    !center.trim() ||
    !isValidDate(contactedAt) ||
    !ALLOWED_CONTACT_STATUSES.has(status)
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Datos del contacto no válidos',
    );
  }

  return { contact, center, contactedAt, status, notes };
};

module.exports = {
  ALLOWED_APPLICATION_STATUSES,
  ALLOWED_CONTACT_STATUSES,
  isOlderThanPendingLimit,
  isStalePending,
  parseApplication,
  parseContact,
  suspendIfStale,
};
