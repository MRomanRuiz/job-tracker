import { LABELS } from '../shared/lib/labels';
import { formatDate } from '../shared/lib/utils';

export const APPLICATION_FIELDS = [
  {
    name: 'company',
    label: LABELS.fields.company,
    placeholder: LABELS.fields.company,
    required: true,
  },
  {
    name: 'position',
    label: LABELS.fields.position,
    placeholder: LABELS.fields.position,
    required: true,
  },
  {
    name: 'type',
    label: LABELS.fields.type,
    placeholder: LABELS.fields.type,
    type: 'select',
    required: true,
    options: [
      { value: 'industry', label: LABELS.applicationTypes.industry },
      { value: 'research', label: LABELS.applicationTypes.research },
    ],
    format: value => LABELS.applicationTypes[value] || value,
  },
  {
    name: 'country',
    label: LABELS.fields.country,
    placeholder: LABELS.fields.country,
    required: true,
  },
  { name: 'city', label: LABELS.fields.city, placeholder: LABELS.fields.city },
  {
    name: 'appliedAt',
    label: LABELS.fields.appliedAt,
    type: 'date',
    format: formatDate,
    create: false,
    editable: false,
  },
  {
    name: 'durationType',
    label: LABELS.common.contractType,
    placeholder: LABELS.common.contractType,
    type: 'select',
    options: [
      { value: '', label: LABELS.common.contractType },
      { value: 'fixed', label: LABELS.fields.fixed },
      { value: 'indefinite', label: LABELS.fields.indefinite },
    ],
    format: value =>
      ({ fixed: LABELS.fields.fixed, indefinite: LABELS.fields.indefinite })[value] || '—',
  },
  {
    name: 'durationMonths',
    label: LABELS.fields.durationMonths,
    placeholder: LABELS.fields.conditionalDuration,
    type: 'number',
    min: 1,
    format: value => value ?? '—',
  },
  {
    name: 'status',
    label: LABELS.fields.status,
    type: 'select',
    create: false,
    required: true,
    badge: true,
    options: [
      { value: 'pending', label: LABELS.statuses.application.pending },
      { value: 'interview', label: LABELS.statuses.application.interview },
      { value: 'offer', label: LABELS.statuses.application.offer },
      { value: 'accepted', label: LABELS.statuses.application.accepted },
      { value: 'declined', label: LABELS.statuses.application.declined },
      { value: 'rejected', label: LABELS.statuses.application.rejected },
    ],
    format: value => LABELS.statuses.application[value] || value,
  },
  {
    name: 'notes',
    label: LABELS.fields.notes,
    type: 'textarea',
    multiline: true,
    create: false,
  },
];

export const CONTACT_FIELDS = [
  {
    name: 'contact',
    label: LABELS.fields.name,
    placeholder: LABELS.fields.name,
    required: true,
  },
  {
    name: 'email',
    label: LABELS.fields.emailContact,
    placeholder: LABELS.fields.emailOrContact,
    required: true,
  },
  {
    name: 'institution',
    label: LABELS.fields.institution,
    placeholder: LABELS.fields.institution,
    required: true,
  },
  {
    name: 'country',
    label: LABELS.fields.country,
    placeholder: LABELS.fields.country,
    required: true,
  },
  {
    name: 'department',
    label: LABELS.fields.department,
    placeholder: LABELS.fields.department,
  },
  { name: 'city', label: LABELS.fields.city, placeholder: LABELS.fields.city },
  {
    name: 'contactedAt',
    label: LABELS.fields.contactedAt,
    type: 'date',
    required: true,
    format: formatDate,
    create: false,
    editable: false,
  },
  {
    name: 'status',
    label: LABELS.fields.status,
    type: 'select',
    create: false,
    required: true,
    badge: true,
    options: [
      { value: 'pending', label: LABELS.statuses.contact.pending },
      { value: 'in_conversation', label: LABELS.statuses.contact.in_conversation },
      { value: 'follow_up', label: LABELS.statuses.contact.follow_up },
      { value: 'completed', label: LABELS.statuses.contact.completed },
      { value: 'rejected', label: LABELS.statuses.contact.rejected },
    ],
    format: value => LABELS.statuses.contact[value] || value,
  },
  {
    name: 'notes',
    label: LABELS.fields.notes,
    type: 'textarea',
    multiline: true,
    create: false,
  },
];

export const getRecordFields = kind =>
  kind === 'application' ? APPLICATION_FIELDS : CONTACT_FIELDS;

export const getRecordCreateFields = kind =>
  getRecordFields(kind).filter(field => field.create !== false);
