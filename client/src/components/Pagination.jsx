function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  buttonClassName,
  previousLabel = 'Anterior',
  nextLabel = 'Siguiente',
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button
        type="button"
        className={buttonClassName}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        {previousLabel}
      </button>

      <span>
        Página {currentPage} de {totalPages}
      </span>

      <button
        type="button"
        className={buttonClassName}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {nextLabel}
      </button>
    </div>
  );
}

export default Pagination;
