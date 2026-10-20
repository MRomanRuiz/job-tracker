function StatusSelect({ value, statuses, labels, onChange }) {
  const options =
    value === 'suspended'
      ? [...statuses.filter(status => status !== 'pending'), 'suspended']
      : statuses;

  return (
    <select
      className={`status-select ${value}`}
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      {options.map(status => (
        <option key={status} value={status}>
          {labels[status]}
        </option>
      ))}
    </select>
  );
}

export default StatusSelect;
