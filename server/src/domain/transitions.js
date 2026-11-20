const { HTTP_STATUS, HttpError } = require('./httpError');
const { RECORD_STATUSES, RECORD_TRANSITIONS } = require('../../../shared/constants.json');
const APPLICATION_TRANSITIONS = RECORD_TRANSITIONS.application;
const CONTACT_TRANSITIONS = RECORD_TRANSITIONS.contact;

const isContactTransitionStatus = status =>
  ALLOWED_CONTACT_STATUSES.has(status) || status === RECORD_STATUSES.suspended;

const ALLOWED_CONTACT_STATUSES = new Set(RECORD_STATUSES.contact);
const ALLOWED_APPLICATION_STATUSES = new Set(RECORD_STATUSES.application);

const canTransitionContact = (currentStatus, nextStatus) =>
  isContactTransitionStatus(currentStatus) &&
  isContactTransitionStatus(nextStatus) &&
  CONTACT_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;

const isApplicationTransitionStatus = status =>
  ALLOWED_APPLICATION_STATUSES.has(status) || status === RECORD_STATUSES.suspended;

const canTransitionApplication = (currentStatus, nextStatus) =>
  isApplicationTransitionStatus(currentStatus) &&
  isApplicationTransitionStatus(nextStatus) &&
  APPLICATION_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;

const validateContactTransition = (currentStatus, nextStatus) => {
  if (!ALLOWED_CONTACT_STATUSES.has(nextStatus) && nextStatus !== RECORD_STATUSES.suspended) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Invalid contact status',
      `Status must be one of: ${[...ALLOWED_CONTACT_STATUSES].join(', ')}.`,
    );
  }

  if (!canTransitionContact(currentStatus, nextStatus)) {
    throw new HttpError(
      HTTP_STATUS.CONFLICT,
      'Invalid contact status transition',
      `Cannot transition from ${currentStatus} to ${nextStatus}.`,
    );
  }
};

const validateApplicationTransition = (currentStatus, nextStatus) => {
  if (!ALLOWED_APPLICATION_STATUSES.has(nextStatus) && nextStatus !== RECORD_STATUSES.suspended) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      'Invalid application status',
      `Status must be one of: ${[...ALLOWED_APPLICATION_STATUSES].join(', ')}.`,
    );
  }

  if (!canTransitionApplication(currentStatus, nextStatus)) {
    throw new HttpError(
      HTTP_STATUS.CONFLICT,
      'Invalid application status transition',
      `Cannot transition from ${currentStatus} to ${nextStatus}.`,
    );
  }
};

module.exports = {
  APPLICATION_TRANSITIONS,
  CONTACT_TRANSITIONS,
  ALLOWED_APPLICATION_STATUSES,
  canTransitionApplication,
  validateApplicationTransition,
  ALLOWED_CONTACT_STATUSES,
  canTransitionContact,
  validateContactTransition,
};
