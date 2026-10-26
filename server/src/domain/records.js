const { HTTP_STATUS, HttpError } = require('./httpError');

const MAX_PENDING_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const ALLOWED_APPLICATION_STATUSES = new Set(['pending', 'interview', 'offer', 'rejected']);

const ALLOWED_CONTACT_STATUSES = new Set(['pending', 'replied', 'rejected']);

const APPLICATION_TEXT_FIELDS = ['company', 'position', 'city', 'country', 'type', 'notes'];

const ALLOWED_APPLICATION_TYPES = new Set(['industry', 'research']);

const APPLICATION_DURATION_TYPES = new Set(['fixed', 'indefinite']);

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
  record.status === 'pending' && isOlderThanPendingLimit(record[dateField]);

const isValidDate = value => {
  if (typeof value !== 'string' || !TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(value.slice(0, 10));

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value.slice(0, 10) &&
    !Number.isNaN(new Date(value).getTime())
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Cuerpo de la petición no válido');
  }
};

const parseTextFields = (body, fields, errorMessage) =>
  Object.fromEntries(
    fields.map(field => {
      const value = body[field] ?? '';

      if (typeof value !== 'string') {
        throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
      }

      return [field, value.trim()];
    }),
  );

const hasEmptyFields = (data, fields) => fields.some(field => !data[field]);

const parseApplication = body => {
  const errorMessage = 'Datos de la candidatura no válidos';

  assertValidBody(body);

  const application = parseTextFields(body, APPLICATION_TEXT_FIELDS, errorMessage);

  const status = body.status ?? 'pending';
  const durationType = body.durationType ?? '';
  const durationMonths =
    body.durationMonths === '' || body.durationMonths == null ? null : body.durationMonths;

  const hasInvalidDurationType =
    durationType !== '' && !APPLICATION_DURATION_TYPES.has(durationType);

  const hasInvalidDurationMonths =
    durationType === 'fixed'
      ? durationMonths !== null && (!Number.isInteger(durationMonths) || durationMonths <= 0)
      : durationMonths !== null;

  const hasInvalidApplicationData = [
    hasEmptyFields(application, ['company', 'position', 'type']),
    !isValidDate(body.appliedAt),
    !ALLOWED_APPLICATION_STATUSES.has(status),
    !ALLOWED_APPLICATION_TYPES.has(application.type),
    hasInvalidDurationType,
    hasInvalidDurationMonths,
  ].some(Boolean);

  if (hasInvalidApplicationData) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
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

  const contactData = parseTextFields(body, CONTACT_TEXT_FIELDS, errorMessage);

  const status = body.status ?? 'pending';

  const hasInvalidContactData = [
    hasEmptyFields(contactData, ['contact', 'email', 'institution', 'country']),
    !isValidDate(body.contactedAt),
    !ALLOWED_CONTACT_STATUSES.has(status),
  ].some(Boolean);

  if (hasInvalidContactData) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  return {
    ...contactData,
    contactedAt: body.contactedAt,
    status,
  };
};

const parseContactChanges = body => {
  const errorMessage = 'Datos del contacto no válidos';

  assertValidBody(body);

  const contactData = Object.fromEntries(
    Object.entries(body)
      .filter(([field]) => CONTACT_TEXT_FIELDS.includes(field))
      .map(([field, value]) => {
        if (typeof value !== 'string') {
          throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
        }

        const parsedValue = value.trim();
        if (['contact', 'email', 'institution', 'country'].includes(field) && !parsedValue) {
          throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
        }

        return [field, parsedValue];
      }),
  );

  if (body.contactedAt !== undefined && !isValidDate(body.contactedAt)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  if (body.status !== undefined && !ALLOWED_CONTACT_STATUSES.has(body.status)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  return {
    ...contactData,
    ...(body.contactedAt !== undefined && { contactedAt: body.contactedAt }),
    ...(body.status !== undefined && { status: body.status }),
  };
};

const parseApplicationTextFieldChange = (field, value, errorMessage) => {
  if (typeof value !== 'string') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  const parsedValue = value.trim();
  if (['company', 'position', 'type'].includes(field) && !parsedValue) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  if (field === 'type' && !ALLOWED_APPLICATION_TYPES.has(parsedValue)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  return parsedValue;
};

const parseApplicationDurationTypeChange = (value, errorMessage) => {
  if (typeof value !== 'string') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  const parsedValue = value.trim();
  if (parsedValue !== '' && !APPLICATION_DURATION_TYPES.has(parsedValue)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  return parsedValue;
};

const parseApplicationDurationMonthsChange = (value, errorMessage) => {
  const parsedValue = value === '' ? null : value;
  if (parsedValue !== null && (!Number.isInteger(parsedValue) || parsedValue <= 0)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }

  return parsedValue;
};

const validateUpdatedApplication = (application, errorMessage) => {
  const hasInvalidApplicationData = [
    hasEmptyFields(application, ['company', 'position', 'type']),
    !isValidDate(application.appliedAt),
    !ALLOWED_APPLICATION_STATUSES.has(application.status),
    !ALLOWED_APPLICATION_TYPES.has(application.type),
    application.durationType !== '' && !APPLICATION_DURATION_TYPES.has(application.durationType),
    application.durationType === 'fixed'
      ? application.durationMonths !== null &&
        (!Number.isInteger(application.durationMonths) || application.durationMonths <= 0)
      : application.durationMonths !== null,
  ].some(Boolean);

  if (hasInvalidApplicationData) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
  }
};

const parseApplicationChanges = (body, currentApplication) => {
  const errorMessage = 'Datos de la candidatura no válidos';

  assertValidBody(body);

  const changes = Object.fromEntries(
    Object.entries(body).map(([field, value]) => {
      if (APPLICATION_TEXT_FIELDS.includes(field)) {
        return [field, parseApplicationTextFieldChange(field, value, errorMessage)];
      }

      if (field === 'status') {
        if (!ALLOWED_APPLICATION_STATUSES.has(value)) {
          throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
        }

        return [field, value];
      }

      if (field === 'durationType') {
        return [field, parseApplicationDurationTypeChange(value, errorMessage)];
      }

      if (field === 'durationMonths') {
        return [field, parseApplicationDurationMonthsChange(value, errorMessage)];
      }

      if (field === 'appliedAt') {
        if (!isValidDate(value)) {
          throw new HttpError(HTTP_STATUS.BAD_REQUEST, errorMessage);
        }

        return [field, value];
      }

      return [field, value];
    }),
  );

  if (Object.keys(changes).some(field => !['status', 'notes'].includes(field))) {
    validateUpdatedApplication({ ...currentApplication, ...changes }, errorMessage);
  }

  return changes;
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
  parseApplicationChanges,
  parseContact,
  parseContactChanges,
};
