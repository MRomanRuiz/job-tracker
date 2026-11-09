import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  CONTACT_STATUS_LABELS,
} from '../shared/lib/constants';
import { formatDate } from '../shared/lib/utils';

const CONTRACT_TYPE_LABEL = 'Tipo de contrato';

export const APPLICATION_FIELDS = [
  { name: 'company', label: 'Empresa', placeholder: 'Empresa', required: true },
  { name: 'position', label: 'Puesto', placeholder: 'Puesto', required: true },
  {
    name: 'type',
    label: 'Tipo',
    placeholder: 'Tipo',
    type: 'select',
    required: true,
    options: [
      { value: 'industry', label: 'Empresa' },
      { value: 'research', label: 'Investigación' },
    ],
    format: value => APPLICATION_TYPE_LABELS[value] || value,
  },
  { name: 'country', label: 'País', placeholder: 'País', required: true },
  { name: 'city', label: 'Ciudad', placeholder: 'Ciudad' },
  {
    name: 'appliedAt',
    label: 'Fecha de candidatura',
    type: 'date',
    format: formatDate,
    create: false,
    editable: false,
  },
  {
    name: 'durationType',
    label: CONTRACT_TYPE_LABEL,
    placeholder: CONTRACT_TYPE_LABEL,
    type: 'select',
    options: [
      { value: '', label: CONTRACT_TYPE_LABEL },
      { value: 'fixed', label: 'Temporal' },
      { value: 'indefinite', label: 'Indefinido' },
    ],
    format: value => ({ fixed: 'Temporal', indefinite: 'Indefinido' })[value] || '—',
  },
  {
    name: 'durationMonths',
    label: 'Duración (meses)',
    placeholder: 'Duración en meses (si es temporal)',
    type: 'number',
    min: 1,
    format: value => value ?? '—',
  },
  {
    name: 'status',
    label: 'Estado',
    type: 'select',
    create: false,
    required: true,
    badge: true,
    options: [
      { value: 'pending', label: APPLICATION_STATUS_LABELS.pending },
      { value: 'interview', label: APPLICATION_STATUS_LABELS.interview },
      { value: 'offer', label: APPLICATION_STATUS_LABELS.offer },
      { value: 'rejected', label: APPLICATION_STATUS_LABELS.rejected },
    ],
    format: value => APPLICATION_STATUS_LABELS[value] || value,
  },
  {
    name: 'notes',
    label: 'Notas',
    type: 'textarea',
    multiline: true,
    create: false,
  },
];

export const CONTACT_FIELDS = [
  { name: 'contact', label: 'Nombre', placeholder: 'Nombre', required: true },
  { name: 'email', label: 'Email / Contacto', placeholder: 'Email o contacto', required: true },
  {
    name: 'institution',
    label: 'Empresa o universidad',
    placeholder: 'Empresa o universidad',
    required: true,
  },
  { name: 'country', label: 'País', placeholder: 'País', required: true },
  {
    name: 'department',
    label: 'Departamento o laboratorio',
    placeholder: 'Departamento o laboratorio',
  },
  { name: 'city', label: 'Ciudad', placeholder: 'Ciudad' },
  {
    name: 'contactedAt',
    label: 'Fecha de contacto',
    type: 'date',
    required: true,
    format: formatDate,
    create: false,
  },
  {
    name: 'status',
    label: 'Estado',
    type: 'select',
    create: false,
    required: true,
    badge: true,
    options: [
      { value: 'pending', label: CONTACT_STATUS_LABELS.pending },
      { value: 'replied', label: CONTACT_STATUS_LABELS.replied },
      { value: 'rejected', label: CONTACT_STATUS_LABELS.rejected },
    ],
    format: value => CONTACT_STATUS_LABELS[value] || value,
  },
  {
    name: 'notes',
    label: 'Notas',
    type: 'textarea',
    multiline: true,
    create: false,
  },
];

export const getRecordFields = kind =>
  kind === 'application' ? APPLICATION_FIELDS : CONTACT_FIELDS;

export const getRecordCreateFields = kind =>
  getRecordFields(kind).filter(field => field.create !== false);
