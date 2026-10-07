function Pagination({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={onPrevious}
      >
        Anterior
      </button>

      <span>
        Página {currentPage} de {totalPages}
      </span>

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={onNext}
      >
        Siguiente
      </button>
    </div>
  );
}

export default Pagination;
