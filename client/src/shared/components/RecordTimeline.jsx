import { LABELS } from '../lib/labels';

function formatTimelineDateTime(date) {
  if (!date) {
    return LABELS.common.unknownDate;
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return LABELS.common.unknownDate;
  }

  return new Intl.DateTimeFormat(LABELS.locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function buildTimelineEvents(record, recordType) {
  const events = (record.history ?? [])
    .filter(event => ['status'].includes(event.field))
    .map((event, index) => ({
      ...event,
      type: event.field,
      date: event.changedAt,
      key: `${event.changedAt}-${event.field}-${index}`,
    }));

  const creationDate = recordType === 'application' ? record.appliedAt : record.contactedAt;

  if (creationDate) {
    events.push({
      type: 'created',
      date: creationDate,
      key: 'created',
    });
  }

  events.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    return (Number.isNaN(dateA) ? 0 : dateA) - (Number.isNaN(dateB) ? 0 : dateB);
  });

  return events;
}

function TimelineEventDetails({ event, labels }) {
  switch (event.type) {
    case 'created':
      return <h4>{LABELS.timeline.created}</h4>;
    case 'status':
      return (
        <>
          <h4>{LABELS.timeline.statusUpdated}</h4>
          <p className="record-timeline-status">
            <span>{labels[event.oldValue] ?? event.oldValue ?? '—'}</span>
            <span aria-hidden="true"> → </span>
            <strong>{labels[event.newValue] ?? event.newValue ?? '—'}</strong>
          </p>
        </>
      );
    default:
      return null;
  }
}

function TimelineEvent({ event, labels }) {
  return (
    <li className={`record-timeline-event ${event.type}`}>
      <div className="record-timeline-point">
        <span className="record-timeline-dot" aria-hidden="true" />
      </div>

      <div className="record-timeline-card">
        <time className="record-timeline-date" dateTime={event.date}>
          {formatTimelineDateTime(event.date)}
        </time>

        <TimelineEventDetails event={event} labels={labels} />
      </div>
    </li>
  );
}

function RecordTimeline({ record, recordType }) {
  const labels =
    recordType === 'application' ? LABELS.statuses.application : LABELS.statuses.contact;

  const events = buildTimelineEvents(record, recordType);

  if (events.length === 0) {
    return null;
  }

  return (
    <details className="record-timeline">
      <summary className="record-timeline-toggle">
        <h3 className="record-timeline-title">{LABELS.timeline.title}</h3>
        <span className="record-timeline-arrow" aria-hidden="true" />
      </summary>

      <div className="record-timeline-scroll">
        <ol className="record-timeline-track">
          {events.map(event => (
            <TimelineEvent event={event} labels={labels} key={event.key} />
          ))}
        </ol>
      </div>
    </details>
  );
}

export default RecordTimeline;
