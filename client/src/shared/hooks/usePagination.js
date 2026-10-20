import { useMemo, useState } from 'react';

export default function usePagination(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const page = Math.min(currentPage, Math.max(totalPages, 1));

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, totalPages, pageItems, setPage: setCurrentPage };
}
