import { LABELS } from '../lib/labels';

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {LABELS.pagination.previous}
      </button>

      <span>
        {LABELS.pagination.page} {currentPage} {LABELS.pagination.of} {totalPages}
      </span>

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {LABELS.pagination.next}
      </button>
    </div>
  );
}

export default Pagination;
