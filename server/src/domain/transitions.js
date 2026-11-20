const { HTTP_STATUS, HttpError } = require('./httpError');
const { RECORD_STATUSES } = require('../../../shared/constants.json');

const CONTACT_TRANSITIONS = {
  pending: ['in_conversation', 'follow_up', 'rejected', 'suspended'],
  in_conversation: ['follow_up', 'completed', 'rejected', 'suspended'],
  follow_up: ['pending'],
  suspended: ['in_conversation', 'follow_up', 'rejected'],
  completed: [],
  rejected: [],
};

const isContactTransitionStatus = status =>
  ALLOWED_CONTACT_STATUSES.has(status) || status === RECORD_STATUSES.suspended;

const ALLOWED_CONTACT_STATUSES = new Set(RECORD_STATUSES.contact);

const canTransitionContact = (currentStatus, nextStatus) =>
  isContactTransitionStatus(currentStatus) &&
  isContactTransitionStatus(nextStatus) &&
  CONTACT_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;

const validateContactTransition = (currentStatus, nextStatus) => {
  if (
    !ALLOWED_CONTACT_STATUSES.has(nextStatus) &&
    nextStatus !== RECORD_STATUSES.suspended
  ) {
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

module.exports = {
  CONTACT_TRANSITIONS,
  ALLOWED_CONTACT_STATUSES,
  canTransitionContact,
  validateContactTransition,
};
