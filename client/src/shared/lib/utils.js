import { ALL_STATUSES } from './constants.js';
import { LABELS } from './labels.js';

export const isRejected = item => item.status === 'rejected' || item.status === 'suspended';
export const isPending = item => item.status === 'pending' || item.status === 'follow_up';

export const matchesStatus = (item, statusFilter) => {
  if (statusFilter === ALL_STATUSES) {
    return true;
  }

  if (statusFilter === 'pending') {
    return isPending(item);
  }

  if (statusFilter === 'rejected') {
    return isRejected(item);
  }

  return item.status === statusFilter;
};

export const matchesText = (values, searchText) =>
  values.some(value => (value || '').toLowerCase().includes(searchText));

export const sortByDateDesc = (items, dateField) =>
  [...items].sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]));

export const formatDate = value =>
  typeof value === 'string' && value ? value.slice(0, 10) : LABELS.common.unknownDate;

export const replaceById = (items, updatedItem) =>
  items.map(item => (item.id === updatedItem.id ? updatedItem : item));

export const countByStatus = (items, status) =>
  items.filter(item => matchesStatus(item, status)).length;
