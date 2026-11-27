const { HTTP_STATUS, HttpError } = require('./httpError');
const { RECORD_STATUSES } = require('../../../shared/constants.json');

const MAX_STALE_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const VALIDATION_ERROR_CODES = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  INVALID_VALUE: 'INVALID_VALUE',
  FIELD_NOT_ALLOWED: 'FIELD_NOT_ALLOWED',
};

const ALLOWED_APPLICATION_STATUSES = new Set(RECORD_STATUSES.application);

const ALLOWED_APPLICATION_RECORD_STATUSES = new Set([
  ...ALLOWED_APPLICATION_STATUSES,
  RECORD_STATUSES.suspended,
]);

const ALLOWED_CONTACT_STATUSES = new Set(RECORD_STATUSES.contact);

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

const REQUIRED_APPLICATION_FIELDS = ['company', 'position', 'type', 'country'];

const REQUIRED_CONTACT_FIELDS = ['contact', 'email', 'institution', 'country'];

const APPLICATION_FIELDS = [
  ...APPLICATION_TEXT_FIELDS,
  'appliedAt',
  'durationType',
  'durationMonths',
  'status',
];

const CONTACT_FIELDS = [...CONTACT_TEXT_FIELDS, 'contactedAt', 'status'];

const APPLICATION_TYPE_LABEL = 'Application type';
const MUST_BE_STRING_LABEL = 'Must be a string';
const INVALID_APPLICATION_DATA_LABEL = 'Invalid application data';
const DURATION_TYPE_ERROR_LABEL = 'Duration type must be fixed or indefinite';

const APPLICATION_LABELS = {
  company: 'Company',
  position: 'Position',
  type: APPLICATION_TYPE_LABEL,
  country: 'Country',
};

const CONTACT_LABELS = {
  contact: 'Contact name',
  email: 'Email',
  institution: 'Institution',
  country: 'Country',
};

// General validation helpers

const createDetail = (field, code, message) => ({
  field,
  code,
  message,
});

const throwValidationError = (
  message,
  details,
  description = 'One or more fields contain invalid values.',
) => {
  throw new HttpError(HTTP_STATUS.BAD_REQUEST, message, description, details);
};

const assertValidBody = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Invalid request body',
      'The request body must be a non-empty JSON object.',
    );
  }
};

const validateAllowedFields = (body, allowedFields) =>
  Object.keys(body)
    .filter(field => !allowedFields.includes(field))
    .map(field =>
      createDetail(field, VALIDATION_ERROR_CODES.FIELD_NOT_ALLOWED, 'This field is not allowed'),
    );

const parseTextFields = (body, fields) => {
  const data = {};
  const details = [];

  for (const field of fields) {
    const value = body[field] === undefined ? '' : body[field];

    if (typeof value === 'string') {
      data[field] = value.trim();
      continue; // NOSONAR
    }

    details.push(createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL));
  }

  return { data, details };
};

const validateRequiredFields = (data, fields, labels, existingDetails = []) =>
  fields
    .filter(field => !data[field] && !existingDetails.some(detail => detail.field === field))
    .map(field =>
      createDetail(field, VALIDATION_ERROR_CODES.REQUIRED_FIELD, `${labels[field]} is required`),
    );

const validateEnumField = (field, value, allowedValues, label) => {
  if (typeof value !== 'string') {
    return [createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL)];
  }

  if (!allowedValues.has(value)) {
    return [
      createDetail(
        field,
        VALIDATION_ERROR_CODES.INVALID_VALUE,
        `${label} must be ${[...allowedValues].join(', ')}`,
      ),
    ];
  }

  return [];
};

const validateDateField = (field, value) => {
  if (value === undefined || value === null || value === '') {
    return [createDetail(field, VALIDATION_ERROR_CODES.REQUIRED_FIELD, 'This field is required')];
  }

  if (typeof value !== 'string') {
    return [createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL)];
  }

  if (!isValidDate(value)) {
    return [
      createDetail(
        field,
        VALIDATION_ERROR_CODES.INVALID_FORMAT,
        'Must be a valid ISO 8601 timestamp in UTC',
      ),
    ];
  }

  return [];
};

const validateTextField = (field, value, required = false) => {
  if (typeof value !== 'string') {
    return [createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL)];
  }

  if (required && !value.trim()) {
    return [createDetail(field, VALIDATION_ERROR_CODES.REQUIRED_FIELD, 'This field is required')];
  }

  return [];
};

// Date and stale-record validation

const isOlderThanStaleLimit = (date, now = new Date()) => {
  if (!isValidDate(date)) {
    return false;
  }

  const parsedDate = new Date(date);

  const dateDay = Date.UTC(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
  );

  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return (nowDay - dateDay) / MS_PER_DAY > MAX_STALE_DAYS;
};

const getStaleActivityDate = record => {
  const latestChange = (record.history ?? [])
    .filter(event => event && isValidDate(event.changedAt))
    .reduce((latest, event) => {
      const eventTime = new Date(event.changedAt).getTime();
      const latestTime = latest ? new Date(latest.changedAt).getTime() : Number.NEGATIVE_INFINITY;

      return eventTime > latestTime ? event : latest;
    }, null);

  if (latestChange) {
    return { date: latestChange.changedAt, field: latestChange.field };
  }

  if (record.appliedAt !== undefined) {
    return { date: record.appliedAt, field: 'appliedAt' };
  }

  return { date: record.contactedAt, field: 'contactedAt' };
};

const isStaleRecord = (record, alertableStatuses, now = new Date()) =>
  alertableStatuses.includes(record.status) &&
  isOlderThanStaleLimit(getStaleActivityDate(record).date, now);

const isValidDate = value => {
  if (typeof value !== 'string' || !TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
};

const DEFAULT_SUSPEND_IF_STALE_MESSAGES = {
  notAlertable: 'The record status is not eligible for stale alerts',
  tooRecent: 'The record has not exceeded the stale limit',
};

const suspendIfStale = (
  record,
  alertableStatuses,
  messages = DEFAULT_SUSPEND_IF_STALE_MESSAGES,
  now = new Date(),
) => {
  if (!alertableStatuses.includes(record.status)) {
    throwValidationError(
      messages.notAlertable,
      [
        createDetail(
          'status',
          VALIDATION_ERROR_CODES.INVALID_VALUE,
          'Record status must allow stale alerts',
        ),
      ],
      'Only records eligible for stale alerts can be suspended.',
    );
  }

  const activity = getStaleActivityDate(record);

  if (!isOlderThanStaleLimit(activity.date, now)) {
    throwValidationError(
      messages.tooRecent,
      [
        createDetail(
          activity.field,
          VALIDATION_ERROR_CODES.INVALID_VALUE,
          `Record must be older than ${MAX_STALE_DAYS} days`,
        ),
      ],
      `The record must exceed the ${MAX_STALE_DAYS}-day stale limit.`,
    );
  }
};

const validateApplicationDuration = (durationType, durationMonths) => {
  if (typeof durationType !== 'string') {
    return [
      createDetail('durationType', VALIDATION_ERROR_CODES.INVALID_TYPE, DURATION_TYPE_ERROR_LABEL),
    ];
  }

  if (durationType !== '' && !APPLICATION_DURATION_TYPES.has(durationType)) {
    return [
      createDetail('durationType', VALIDATION_ERROR_CODES.INVALID_VALUE, DURATION_TYPE_ERROR_LABEL),
    ];
  }

  if (durationType === 'fixed') {
    if (!Number.isInteger(durationMonths)) {
      return [
        createDetail(
          'durationMonths',
          durationMonths === null
            ? VALIDATION_ERROR_CODES.REQUIRED_FIELD
            : VALIDATION_ERROR_CODES.INVALID_TYPE,
          durationMonths === null
            ? 'Duration months are required for fixed-duration applications'
            : 'Must be an integer',
        ),
      ];
    }

    if (durationMonths <= 0) {
      return [
        createDetail(
          'durationMonths',
          VALIDATION_ERROR_CODES.INVALID_VALUE,
          'Must be a positive integer',
        ),
      ];
    }

    return [];
  }

  if (durationMonths !== null) {
    return [
      createDetail(
        'durationMonths',
        VALIDATION_ERROR_CODES.INVALID_VALUE,
        'Duration months can only be specified for fixed-duration applications',
      ),
    ];
  }

  return [];
};

const parseApplication = body => {
  assertValidBody(body);

  const details = validateAllowedFields(body, APPLICATION_FIELDS);

  const { data: application, details: textDetails } = parseTextFields(
    body,
    APPLICATION_TEXT_FIELDS,
  );

  details.push(...textDetails);

  const status = body.status ?? 'pending';
  const durationType =
    typeof body.durationType === 'string' ? body.durationType.trim() : (body.durationType ?? '');
  const durationMonths =
    body.durationMonths === '' || body.durationMonths == null ? null : body.durationMonths;

  validateApplicationFields(
    {
      ...application,
      appliedAt: body.appliedAt,
      durationType,
      durationMonths,
      status,
    },
    ALLOWED_APPLICATION_STATUSES,
    details,
  );

  return {
    ...application,
    appliedAt: body.appliedAt,
    durationType,
    durationMonths,
    status,
  };
};

const validateApplicationFields = (application, allowedStatuses, existingDetails = []) => {
  const details = [
    ...existingDetails,
    ...validateRequiredFields(
      application,
      REQUIRED_APPLICATION_FIELDS,
      APPLICATION_LABELS,
      existingDetails,
    ),
    ...(application.type
      ? validateEnumField(
          'type',
          application.type,
          ALLOWED_APPLICATION_TYPES,
          APPLICATION_TYPE_LABEL,
        )
      : []),
    ...validateDateField('appliedAt', application.appliedAt),
    ...validateEnumField('status', application.status, allowedStatuses, 'Status'),
    ...validateApplicationDuration(application.durationType, application.durationMonths),
  ];

  if (details.length > 0) {
    throwValidationError(
      INVALID_APPLICATION_DATA_LABEL,
      details,
      'The application contains invalid values.',
    );
  }
};

const validateContactFields = (contact, existingDetails = []) => {
  const details = [
    ...existingDetails,
    ...validateRequiredFields(contact, REQUIRED_CONTACT_FIELDS, CONTACT_LABELS, existingDetails),
    ...validateEnumField('status', contact.status, ALLOWED_CONTACT_STATUSES, 'Status'),
    ...validateDateField('contactedAt', contact.contactedAt),
  ];

  if (details.length > 0) {
    throwValidationError('Invalid contact data', details, 'The contact contains invalid values.');
  }
};

const normalizeStringValue = value => (typeof value === 'string' ? value.trim() : value);

const addTextFieldChange = (field, value, details, changes, requiredFields) => {
  const required = requiredFields.includes(field);
  const fieldDetails = validateTextField(field, value, required);

  details.push(...fieldDetails);

  if (fieldDetails.length > 0) {
    return false;
  }

  changes[field] = normalizeStringValue(value);
  return true;
};

const addApplicationTextFieldChange = (field, value, details, changes) => {
  const isValid = addTextFieldChange(field, value, details, changes, REQUIRED_APPLICATION_FIELDS);

  if (!isValid) {
    return;
  }

  if (field === 'type') {
    details.push(
      ...validateEnumField(
        field,
        changes[field],
        ALLOWED_APPLICATION_TYPES,
        APPLICATION_TYPE_LABEL,
      ),
    );
  }
};

const addContactTextFieldChange = (field, value, details, changes) =>
  addTextFieldChange(field, value, details, changes, REQUIRED_CONTACT_FIELDS);

const addEnumFieldChange = (field, value, details, changes, allowedValues, label) => {
  const fieldDetails = validateEnumField(field, value, allowedValues, label);
  details.push(...fieldDetails);

  if (fieldDetails.length > 0) {
    return;
  }

  changes[field] = value;
};

const addApplicationStatusChange = (field, value, details, changes) =>
  addEnumFieldChange(field, value, details, changes, ALLOWED_APPLICATION_STATUSES, 'Status');

const addContactStatusChange = (field, value, details, changes) =>
  addEnumFieldChange(field, value, details, changes, ALLOWED_CONTACT_STATUSES, 'Status');

const addDurationTypeChange = (field, value, details, changes) => {
  if (typeof value !== 'string') {
    details.push(createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL));
    return;
  }

  const parsedValue = value.trim();

  if (parsedValue !== '' && !APPLICATION_DURATION_TYPES.has(parsedValue)) {
    details.push(
      createDetail(field, VALIDATION_ERROR_CODES.INVALID_VALUE, DURATION_TYPE_ERROR_LABEL),
    );
    return;
  }

  changes[field] = parsedValue;
};

const addDurationMonthsChange = (field, value, details, changes) => {
  const parsedValue = value === '' ? null : value;

  if (parsedValue !== null) {
    if (!Number.isInteger(parsedValue)) {
      details.push(createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, 'Must be an integer'));
      return;
    }

    if (parsedValue <= 0) {
      details.push(
        createDetail(field, VALIDATION_ERROR_CODES.INVALID_VALUE, 'Must be a positive integer'),
      );
      return;
    }
  }

  changes[field] = parsedValue;
};

const addDateFieldChange = (field, value, details, changes) => {
  const fieldDetails = validateDateField(field, value);

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
    return;
  }

  changes[field] = value;
};

const APPLICATION_CHANGE_HANDLERS = {
  company: addApplicationTextFieldChange,
  position: addApplicationTextFieldChange,
  city: addApplicationTextFieldChange,
  country: addApplicationTextFieldChange,
  type: addApplicationTextFieldChange,
  notes: addApplicationTextFieldChange,
  status: addApplicationStatusChange,
  durationType: addDurationTypeChange,
  durationMonths: addDurationMonthsChange,
  appliedAt: addDateFieldChange,
};

const parseApplicationChanges = (body, currentApplication) => {
  assertValidBody(body);

  const details = validateAllowedFields(body, APPLICATION_FIELDS);
  const changes = {};

  for (const [field, value] of Object.entries(body)) {
    const handler = Object.hasOwn(APPLICATION_CHANGE_HANDLERS, field)
      ? APPLICATION_CHANGE_HANDLERS[field]
      : null;

    if (handler) {
      handler(field, value, details, changes);
    }
  }

  if (details.length > 0) {
    throwValidationError(
      INVALID_APPLICATION_DATA_LABEL,
      details,
      'The application could not be updated because some fields contain invalid values.',
    );
  }

  if (Object.keys(changes).some(field => !['status', 'notes'].includes(field))) {
    validateApplicationFields(
      {
        ...currentApplication,
        ...changes,
      },
      ALLOWED_APPLICATION_RECORD_STATUSES,
    );
  }

  return changes;
};

const parseContact = body => {
  assertValidBody(body);

  const details = validateAllowedFields(body, CONTACT_FIELDS);
  const { data: contactData, details: textDetails } = parseTextFields(body, CONTACT_TEXT_FIELDS);

  details.push(...textDetails);

  const contact = {
    ...contactData,
    contactedAt: body.contactedAt,
    status: body.status ?? 'pending',
  };

  validateContactFields(contact, details);

  return contact;
};

const CONTACT_CHANGE_HANDLERS = {
  contact: addContactTextFieldChange,
  email: addContactTextFieldChange,
  institution: addContactTextFieldChange,
  department: addContactTextFieldChange,
  city: addContactTextFieldChange,
  country: addContactTextFieldChange,
  notes: addContactTextFieldChange,
  contactedAt: addDateFieldChange,
  status: addContactStatusChange,
};

const parseContactChanges = (body, currentContact) => {
  assertValidBody(body);

  const details = validateAllowedFields(body, CONTACT_FIELDS);
  const changes = {};

  for (const [field, value] of Object.entries(body)) {
    const handler = Object.hasOwn(CONTACT_CHANGE_HANDLERS, field)
      ? CONTACT_CHANGE_HANDLERS[field]
      : null;

    if (handler) {
      handler(field, value, details, changes);
    }
  }

  if (details.length > 0) {
    throwValidationError(
      'Invalid contact data',
      details,
      'The contact could not be updated because some fields contain invalid values.',
    );
  }

  if (Object.keys(changes).some(field => !['status', 'notes'].includes(field))) {
    validateContactFields({
      ...currentContact,
      ...changes,
    });
  }

  return changes;
};

module.exports = {
  ALLOWED_APPLICATION_STATUSES,
  ALLOWED_CONTACT_STATUSES,
  ALLOWED_APPLICATION_TYPES,
  APPLICATION_DURATION_TYPES,
  isOlderThanStaleLimit,
  isStaleRecord,
  isValidDate,
  suspendIfStale,
  parseApplication,
  parseApplicationChanges,
  parseContact,
  parseContactChanges,
};
