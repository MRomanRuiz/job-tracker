import { ALL_STATUSES, MAX_PENDING_DAYS } from './constants';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const isOlderThanPendingLimit = (date, now = new Date()) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return (now - parsedDate) / MS_PER_DAY > MAX_PENDING_DAYS;
};

export const getStalePending = (items, dateField) =>
  items.filter(
    item =>
      item.status === 'pending' &&
      isOlderThanPendingLimit(item[dateField]),
  );

export const isRejected = item =>
  item.status === 'rejected' || item.status === 'suspended';

export const matchesStatus = (item, statusFilter) => {
  if (statusFilter === ALL_STATUSES) {
    return true;
  }

  if (statusFilter === 'rejected') {
    return isRejected(item);
  }

  return item.status === statusFilter;
};

export const matchesText = (values, searchText) =>
  values.some(value => (value || '').toLowerCase().includes(searchText));

export const sortByDateDesc = (items, dateField) =>
  [...items].sort(
    (a, b) => new Date(b[dateField]) - new Date(a[dateField]),
  );

export const replaceById = (items, updatedItem) =>
  items.map(item => (item.id === updatedItem.id ? updatedItem : item));

export const countByStatus = (items, status) =>
  items.filter(item => matchesStatus(item, status)).length;
