const TRACKED_FIELDS = ['status', 'notes'];

const createHistoryEvents = (current, changes, changedAt) =>
  TRACKED_FIELDS.filter(
    field => Object.hasOwn(changes, field) && changes[field] !== current[field],
  ).map(field => ({
    oldValue: current[field] ?? null,
    newValue: changes[field],
    field,
    changedAt,
  }));

const prepareRecordUpdate = (current, changes, now = new Date()) => {
  const changedAt = now.toISOString();

  const effectiveChanges = Object.fromEntries(
    Object.entries(changes).filter(([field, value]) => value !== current[field]),
  );

  if (Object.keys(effectiveChanges).length === 0) {
    return current;
  }

  const historyEvents = createHistoryEvents(current, effectiveChanges, changedAt);

  return {
    ...current,
    ...effectiveChanges,
    updatedAt: changedAt,
    history: [...(current.history || []), ...historyEvents],
  };
};

module.exports = {
  TRACKED_FIELDS,
  createHistoryEvents,
  prepareRecordUpdate,
};
