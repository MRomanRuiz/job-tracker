function StatusSelect({ value, statuses, labels, onChange, transitions }) {
  const allowedStatuses = transitions
    ? (transitions[value] ?? []).filter(status => statuses.includes(status))
    : null;

  let options;
  if (transitions) {
    options = allowedStatuses;
  } else if (value === 'suspended') {
    options = [...statuses.filter(status => status !== 'pending'), 'suspended'];
  } else {
    options = statuses;
  }

  return (
    <select
      className={`status-select ${value}`}
      value={value}
      disabled={transitions !== undefined && allowedStatuses.length === 0}
      onChange={event => onChange(event.target.value)}
    >
      {transitions && (
        <option value={value} hidden={allowedStatuses.length > 0} disabled>
          {labels[value] || value}
        </option>
      )}
      {options.map(status => (
        <option key={status} value={status}>
          {labels[status]}
        </option>
      ))}
    </select>
  );
}

export default StatusSelect;
