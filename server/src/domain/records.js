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
  'city',
  'country',
  'type',
  'notes',
];

const ALLOWED_APPLICATION_TYPES = new Set([
  'industry',
  'research',
]);

const APPLICATION_DURATION_TYPES = new Set([
  'fixed',
  'indefinite',
]);

const CONTACT_TEXT_FIELDS = [
  'contact',
  'email',
  'institution',
  'department',
  'city',
  'country',
  'notes',
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

const assertValidBody = body => {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Cuerpo de la petición no válido',
    );
  }
};

const parseTextFields = (body, fields, errorMessage) =>
  Object.fromEntries(
    fields.map(field => {
      const value = body[field] ?? '';

      if (typeof value !== 'string') {
        throw new HttpError(
          HTTP_STATUS.BAD_REQUEST,
          errorMessage,
        );
      }

      return [field, value.trim()];
    }),
  );

const hasEmptyFields = (data, fields) =>
  fields.some(field => !data[field]);

const parseApplication = body => {
  const errorMessage = 'Datos de la candidatura no válidos';

  assertValidBody(body);

  const application = parseTextFields(
    body,
    APPLICATION_TEXT_FIELDS,
    errorMessage,
  );

  const status = body.status ?? 'pending';
  const durationType = body.durationType ?? '';
  const durationMonths = body.durationMonths ?? null;

  const hasInvalidDurationType =
    durationType !== '' &&
    !APPLICATION_DURATION_TYPES.has(durationType);

  const hasInvalidDurationMonths =
    durationType === 'fixed'
      ? !Number.isInteger(durationMonths) || durationMonths <= 0
      : durationMonths !== null;

  const hasInvalidApplicationData = [
    hasEmptyFields(application, [
      'company',
      'position',
      'type',
    ]),
    !isValidDate(body.appliedAt),
    !ALLOWED_APPLICATION_STATUSES.has(status),
    !ALLOWED_APPLICATION_TYPES.has(application.type),
    hasInvalidDurationType,
    hasInvalidDurationMonths,
  ].some(Boolean);

  if (hasInvalidApplicationData) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      errorMessage,
    );
  }

  return {
    ...application,
    appliedAt: body.appliedAt,
    durationType,
    durationMonths,
    status,
  };
};

const parseContact = body => {
  const errorMessage = 'Datos del contacto no válidos';

  assertValidBody(body);

  const contactData = parseTextFields(
    body,
    CONTACT_TEXT_FIELDS,
    errorMessage,
  );

  const status = body.status ?? 'pending';

  const hasInvalidContactData = [
    hasEmptyFields(contactData, [
      'contact',
      'email',
      'institution',
      'country',
    ]),
    !isValidDate(body.contactedAt),
    !ALLOWED_CONTACT_STATUSES.has(status),
  ].some(Boolean);

  if (hasInvalidContactData) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      errorMessage,
    );
  }

  return {
    ...contactData,
    contactedAt: body.contactedAt,
    status,
  };
};

module.exports = {
  ALLOWED_APPLICATION_STATUSES,
  ALLOWED_CONTACT_STATUSES,
  ALLOWED_APPLICATION_TYPES,
  APPLICATION_DURATION_TYPES,
  isOlderThanPendingLimit,
  isStalePending,
  isValidDate,
  suspendIfStale,
  parseApplication,
  parseContact,
};
