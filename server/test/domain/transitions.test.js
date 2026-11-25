const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  APPLICATION_TRANSITIONS,
  CONTACT_TRANSITIONS,
  canTransitionApplication,
  canTransitionContact,
  validateApplicationTransition,
  validateContactTransition,
} = require('../../src/domain/transitions');

const { HttpError } = require('../../src/domain/httpError');

describe('application status transitions', () => {
  it('allows all configured transitions', () => {
    for (const [currentStatus, nextStatuses] of Object.entries(APPLICATION_TRANSITIONS)) {
      for (const nextStatus of nextStatuses) {
        assert.equal(
          canTransitionApplication(currentStatus, nextStatus),
          true,
          `${currentStatus} -> ${nextStatus} should be allowed`,
        );
      }
    }
  });

  it('allows suspending an application that is in interview', () => {
    assert.equal(canTransitionApplication('interview', 'suspended'), true);
  });

  it('rejects transitions not explicitly configured and unknown statuses', () => {
    for (const [currentStatus, nextStatus] of [
      ['pending', 'offer'],
      ['interview', 'pending'],
      ['accepted', 'pending'],
      ['declined', 'interview'],
      ['rejected', 'offer'],
      ['unknown', 'pending'],
      ['pending', 'unknown'],
    ]) {
      assert.equal(canTransitionApplication(currentStatus, nextStatus), false);
    }
  });

  it('throws a conflict error for invalid transitions and a bad request for unknown statuses', () => {
    assert.throws(
      () => validateApplicationTransition('accepted', 'pending'),
      error =>
        error instanceof HttpError &&
        error.statusCode === 409 &&
        error.message === 'Invalid application status transition',
    );
    assert.throws(
      () => validateApplicationTransition('pending', 'unknown'),
      error =>
        error instanceof HttpError &&
        error.statusCode === 400 &&
        error.message === 'Invalid application status',
    );
  });
});

describe('contact status transitions', () => {
  it('allows all configured transitions', () => {
    for (const [currentStatus, nextStatuses] of Object.entries(CONTACT_TRANSITIONS)) {
      for (const nextStatus of nextStatuses) {
        assert.equal(
          canTransitionContact(currentStatus, nextStatus),
          true,
          `${currentStatus} -> ${nextStatus} should be allowed`,
        );
      }
    }
  });

  it('rejects transitions not explicitly configured', () => {
    const invalidTransitions = [
      ['pending', 'completed'],
      ['pending', 'pending'],
      ['in_conversation', 'pending'],
      ['follow_up', 'pending'],
      ['follow_up', 'completed'],
      ['suspended', 'completed'],
      ['completed', 'pending'],
      ['completed', 'in_conversation'],
      ['rejected', 'pending'],
      ['rejected', 'in_conversation'],
    ];

    for (const [currentStatus, nextStatus] of invalidTransitions) {
      assert.equal(
        canTransitionContact(currentStatus, nextStatus),
        false,
        `${currentStatus} -> ${nextStatus} should be rejected`,
      );
    }
  });

  it('rejects unknown current or next statuses', () => {
    assert.equal(canTransitionContact('unknown', 'pending'), false);
    assert.equal(canTransitionContact('pending', 'unknown'), false);
    assert.equal(canTransitionContact(undefined, 'pending'), false);
  });

  it('does not allow transitions from terminal statuses', () => {
    for (const terminalStatus of ['completed', 'rejected']) {
      for (const nextStatus of Object.keys(CONTACT_TRANSITIONS)) {
        assert.equal(canTransitionContact(terminalStatus, nextStatus), false);
      }
    }
  });

  it('does not throw for valid transitions', () => {
    assert.doesNotThrow(() => {
      validateContactTransition('pending', 'in_conversation');
    });

    assert.doesNotThrow(() => {
      validateContactTransition('pending', 'follow_up');
    });

    assert.doesNotThrow(() => {
      validateContactTransition('follow_up', 'in_conversation');
    });

    assert.doesNotThrow(() => {
      validateContactTransition('pending', 'suspended');
    });

    assert.doesNotThrow(() => {
      validateContactTransition('suspended', 'in_conversation');
    });

    assert.doesNotThrow(() => {
      validateContactTransition('in_conversation', 'completed');
    });
  });

  it('throws a conflict error for invalid transitions', () => {
    assert.throws(
      () => validateContactTransition('completed', 'pending'),
      error =>
        error instanceof HttpError &&
        error.statusCode === 409 &&
        error.message === 'Invalid contact status transition',
    );
  });

  it('throws a bad request error for unknown next statuses', () => {
    assert.throws(
      () => validateContactTransition('pending', 'unknown'),
      error =>
        error instanceof HttpError &&
        error.statusCode === 400 &&
        error.message === 'Invalid contact status',
    );
  });
});
