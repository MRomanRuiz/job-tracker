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
  'scheduledAt',
  'durationType',
  'durationMonths',
  'status',
];

const CONTACT_FIELDS = [...CONTACT_TEXT_FIELDS, 'contactedAt', 'scheduledAt', 'status'];

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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Invalid request body',
      'The request body must be a valid JSON object.',
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
    const value = body[field] ?? '';

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

const validateOptionalDateField = (field, value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  return validateDateField(field, value);
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
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return (now - parsedDate) / MS_PER_DAY > MAX_STALE_DAYS;
};

const getStaleActivityDate = record => {
  const latestStatusChange = (record.history ?? [])
    .filter(event => event.field === 'status' && typeof event.changedAt === 'string')
    .reduce((latest, event) => {
      const eventTime = new Date(event.changedAt).getTime();
      const latestTime = latest ? new Date(latest).getTime() : Number.NEGATIVE_INFINITY;

      return !Number.isNaN(eventTime) && eventTime > latestTime ? event.changedAt : latest;
    }, null);

  if (latestStatusChange) {
    return { date: latestStatusChange, field: 'status' };
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

  const date = new Date(value.slice(0, 10));

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value.slice(0, 10) &&
    !Number.isNaN(new Date(value).getTime())
  );
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

// Application validation

const validateDurationType = durationType => {
  if (typeof durationType !== 'string') {
    return [
      createDetail('durationType', VALIDATION_ERROR_CODES.INVALID_TYPE, DURATION_TYPE_ERROR_LABEL),
    ];
  }

  if (durationType === '') {
    return [];
  }

  if (!APPLICATION_DURATION_TYPES.has(durationType)) {
    return [
      createDetail('durationType', VALIDATION_ERROR_CODES.INVALID_VALUE, DURATION_TYPE_ERROR_LABEL),
    ];
  }

  return [];
};

const validateFixedDurationMonths = durationMonths => {
  if (durationMonths === null) {
    return [];
  }

  if (!Number.isInteger(durationMonths)) {
    return [
      createDetail('durationMonths', VALIDATION_ERROR_CODES.INVALID_TYPE, 'Must be an integer'),
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
};

const validateNonFixedDurationMonths = durationMonths => {
  if (durationMonths === null) {
    return [];
  }

  return [
    createDetail(
      'durationMonths',
      VALIDATION_ERROR_CODES.INVALID_VALUE,
      'Duration months can only be specified for fixed-duration applications',
    ),
  ];
};

const validateApplicationDuration = (durationType, durationMonths) => {
  const durationTypeDetails = validateDurationType(durationType);

  if (durationTypeDetails.length > 0) {
    return durationTypeDetails;
  }

  if (durationType === 'fixed') {
    return validateFixedDurationMonths(durationMonths);
  }

  return validateNonFixedDurationMonths(durationMonths);
};

const parseApplication = body => {
  const errorMessage = INVALID_APPLICATION_DATA_LABEL;

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

  details.push(
    ...validateRequiredFields(
      application,
      REQUIRED_APPLICATION_FIELDS,
      APPLICATION_LABELS,
      textDetails,
    ),
    ...(application.type
      ? validateEnumField(
          'type',
          application.type,
          ALLOWED_APPLICATION_TYPES,
          APPLICATION_TYPE_LABEL,
        )
      : []),
    ...validateEnumField('status', status, ALLOWED_APPLICATION_STATUSES, 'Status'),
    ...validateDateField('appliedAt', body.appliedAt),
    ...validateApplicationDuration(durationType, durationMonths),
    ...validateOptionalDateField('scheduledAt', body.scheduledAt),
  );

  if (details.length > 0) {
    throwValidationError(
      errorMessage,
      details,
      'The application could not be created because some fields contain invalid values.',
    );
  }

  return {
    ...application,
    appliedAt: body.appliedAt,
    durationType,
    durationMonths,
    status,
    scheduledAt: body.scheduledAt ?? null,
  };
};

const validateUpdatedApplication = application => {
  const details = [
    ...validateRequiredFields(application, REQUIRED_APPLICATION_FIELDS, APPLICATION_LABELS),
    ...(application.type
      ? validateEnumField(
          'type',
          application.type,
          ALLOWED_APPLICATION_TYPES,
          APPLICATION_TYPE_LABEL,
        )
      : []),
    ...validateDateField('appliedAt', application.appliedAt),
    ...validateEnumField(
      'status',
      application.status,
      ALLOWED_APPLICATION_RECORD_STATUSES,
      'Status',
    ),
    ...validateApplicationDuration(application.durationType, application.durationMonths),
    ...validateOptionalDateField('scheduledAt', application.scheduledAt),
  ];

  if (details.length > 0) {
    throwValidationError(
      INVALID_APPLICATION_DATA_LABEL,
      details,
      'The updated application contains invalid values.',
    );
  }
};

const normalizeStringValue = value => (typeof value === 'string' ? value.trim() : value);

const addTextFieldChange = (field, value, details, changes) => {
  const fieldDetails = validateTextField(field, value, REQUIRED_APPLICATION_FIELDS.includes(field));

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
  }

  const parsedValue = normalizeStringValue(value);

  if (
    field === 'type' &&
    typeof value === 'string' &&
    parsedValue &&
    !ALLOWED_APPLICATION_TYPES.has(parsedValue)
  ) {
    details.push(
      createDetail(
        field,
        VALIDATION_ERROR_CODES.INVALID_VALUE,
        'Application type must be industry or research',
      ),
    );
  }

  changes[field] = parsedValue;
};

const addOptionalDateFieldChange = (field, value, details, changes) => {
  const normalizedValue = value === '' ? null : value;
  const fieldDetails = validateOptionalDateField(field, normalizedValue);

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
  }

  changes[field] = normalizedValue;
};

const addEnumFieldChange = (field, value, details, changes, allowedValues, label) => {
  const fieldDetails = validateEnumField(field, value, allowedValues, label);

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
  }

  changes[field] = value;
};

const addDurationTypeChange = (field, value, details, changes) => {
  if (typeof value !== 'string') {
    details.push(createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, MUST_BE_STRING_LABEL));
    changes[field] = value;
    return;
  }

  const parsedValue = value.trim();

  if (parsedValue !== '' && !APPLICATION_DURATION_TYPES.has(parsedValue)) {
    details.push(
      createDetail(field, VALIDATION_ERROR_CODES.INVALID_VALUE, DURATION_TYPE_ERROR_LABEL),
    );
  }

  changes[field] = parsedValue;
};

const addDurationMonthsChange = (field, value, details, changes) => {
  const parsedValue = value === '' ? null : value;

  if (parsedValue !== null) {
    if (!Number.isInteger(parsedValue)) {
      details.push(createDetail(field, VALIDATION_ERROR_CODES.INVALID_TYPE, 'Must be an integer'));
    } else if (parsedValue <= 0) {
      details.push(
        createDetail(field, VALIDATION_ERROR_CODES.INVALID_VALUE, 'Must be a positive integer'),
      );
    } else {
      // The value is a valid positive integer.
    }
  }

  changes[field] = parsedValue;
};

const addDateFieldChange = (field, value, details, changes) => {
  const fieldDetails = validateDateField(field, value);

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
  }

  changes[field] = value;
};

const APPLICATION_CHANGE_HANDLERS = {
  company: addTextFieldChange,
  position: addTextFieldChange,
  city: addTextFieldChange,
  country: addTextFieldChange,
  type: addTextFieldChange,
  notes: addTextFieldChange,
  status: (field, value, details, changes) =>
    addEnumFieldChange(field, value, details, changes, ALLOWED_APPLICATION_STATUSES, 'Status'),
  durationType: addDurationTypeChange,
  durationMonths: addDurationMonthsChange,
  appliedAt: addDateFieldChange,
  scheduledAt: addOptionalDateFieldChange,
};

const parseApplicationChanges = (body, currentApplication) => {
  const errorMessage = INVALID_APPLICATION_DATA_LABEL;

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
      errorMessage,
      details,
      'The application could not be updated because some fields contain invalid values.',
    );
  }

  if (Object.keys(changes).some(field => !['status', 'notes'].includes(field))) {
    validateUpdatedApplication({
      ...currentApplication,
      ...changes,
    });
  }

  return changes;
};

// Contact validation

const parseContact = body => {
  const errorMessage = 'Invalid contact data';

  assertValidBody(body);

  const details = validateAllowedFields(body, CONTACT_FIELDS);

  const { data: contactData, details: textDetails } = parseTextFields(body, CONTACT_TEXT_FIELDS);

  details.push(...textDetails);

  const status = body.status ?? 'pending';

  details.push(
    ...validateRequiredFields(contactData, REQUIRED_CONTACT_FIELDS, CONTACT_LABELS, textDetails),
    ...validateEnumField('status', status, ALLOWED_CONTACT_STATUSES, 'Status'),
    ...validateDateField('contactedAt', body.contactedAt),
    ...validateOptionalDateField('scheduledAt', body.scheduledAt),
  );

  if (details.length > 0) {
    throwValidationError(
      errorMessage,
      details,
      'The contact could not be created because some fields contain invalid values.',
    );
  }

  return {
    ...contactData,
    contactedAt: body.contactedAt,
    status,
    scheduledAt: body.scheduledAt ?? null,
  };
};

const addContactTextFieldChange = (field, value, details, changes) => {
  const fieldDetails = validateTextField(field, value, REQUIRED_CONTACT_FIELDS.includes(field));

  if (fieldDetails.length > 0) {
    details.push(...fieldDetails);
  }

  changes[field] = normalizeStringValue(value);
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
  status: (field, value, details, changes) =>
    addEnumFieldChange(field, value, details, changes, ALLOWED_CONTACT_STATUSES, 'Status'),
  scheduledAt: addOptionalDateFieldChange,
};

const parseContactChanges = body => {
  const errorMessage = 'Invalid contact data';

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
      errorMessage,
      details,
      'The contact could not be updated because some fields contain invalid values.',
    );
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
