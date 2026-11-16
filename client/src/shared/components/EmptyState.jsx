import { LABELS } from '../lib/labels';

function EmptyState({ label }) {
  return (
    <div className="empty-state">
      <h3>{LABELS.emptyState.noRecords.replace('{label}', label)}</h3>
      <p>{LABELS.emptyState.noMatches.replace('{label}', label)}</p>
    </div>
  );
}

export default EmptyState;
