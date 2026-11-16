import { useMemo, useState } from 'react';
import { ALL_STATUSES, APPLICATION_TYPE_LABELS, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import usePagination from '../../shared/hooks/usePagination';
import {
  countByStatus,
  formatDate,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../../shared/lib/utils';
import ApplicationsTable from './ApplicationsTable';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import StaleItemsAlert from '../../shared/components/StaleItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import NoteForm from '../../shared/components/NoteForm';
import RecordDetails from '../../shared/components/RecordDetails';
import RecordEditForm from '../../shared/components/RecordEditForm';
import { getRecordCreateFields } from '../../lib/recordFields';
import DeleteConfirm from '../../shared/components/DeleteConfirm';

const APPLICATION_CREATE_FIELDS = getRecordCreateFields('application');
const REQUIRED_FORM_FIELDS = APPLICATION_CREATE_FIELDS.filter(field => field.required);
const OPTIONAL_FORM_FIELDS = APPLICATION_CREATE_FIELDS.filter(field => !field.required);

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: 'Total' },
  { status: 'pending', label: 'En espera' },
  { status: 'interview', label: 'Entrevistas' },
  { status: 'rejected', label: 'Rechazadas' },
];

const renderStaleApplication = application => (
  <>
    <span className="stale-primary" title={application.company}>
      {application.company}
    </span>
    <span title={application.position}>{application.position}</span>
    <span>{APPLICATION_TYPE_LABELS[application.type] || application.type}</span>
    <span className="stale-date">{formatDate(application.appliedAt)}</span>
  </>
);

function Applications({ collection, showForm, onCloseForm }) {
  const { items: applications, staleItems, create, update, suspend, remove } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState('');
  const [noteApplication, setNoteApplication] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [editingApplication, setEditingApplication] = useState(null);
  const [deletingApplication, setDeletingApplication] = useState(null);

  const filteredApplications = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return sortByDateDesc(
      applications.filter(
        job =>
          matchesText(
            [job.company, job.position, job.country, job.type, job.city, job.notes],
            searchText,
          ) &&
          matchesStatus(job, statusFilter) &&
          (typeFilter === '' || job.type === typeFilter),
      ),
      'appliedAt',
    );
  }, [applications, search, statusFilter, typeFilter]);

  const {
    page,
    totalPages,
    pageItems: paginatedApplications,
    setPage,
  } = usePagination(filteredApplications, ITEMS_PER_PAGE);

  const statItems = STAT_ITEMS.map(item => ({
    ...item,
    value: countByStatus(applications, item.status),
  }));

  const handleCreate = async values => {
    const appliedAt = new Date().toISOString();

    if (await create({ ...values, notes: '', appliedAt })) {
      onCloseForm();
    }
  };

  const handleSaveNote = async notes => {
    if (await update(noteApplication.id, { notes })) {
      setNoteApplication(null);
    }
  };

  const handleStatClick = status => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSearchChange = value => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeChange = value => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleDelete = id => {
    setDeletingApplication(id);
  };

  const confirmDelete = async () => {
    if (await remove(deletingApplication)) {
      setSelectedApplication(null);
      setDeletingApplication(null);
    }
  };

  return (
    <>
      <StaleItemsAlert
        items={staleItems}
        singularLabel="candidatura pendiente"
        pluralLabel="candidaturas pendientes"
        itemType="application"
        renderCells={renderStaleApplication}
        onSuspend={suspend}
        onOpen={setSelectedApplication}
      />

      {showForm && (
        <div className="record-form-wrapper">
          <RecordForm
            title="Nueva candidatura"
            requiredFields={REQUIRED_FORM_FIELDS}
            optionalFields={OPTIONAL_FORM_FIELDS}
            submitLabel="Guardar candidatura"
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        </div>
      )}

      <main>
        <StatCards items={statItems} activeStatus={statusFilter} onSelect={handleStatClick} />

        <Toolbar
          search={search}
          placeholder="Buscar empresa, puesto..."
          onSearchChange={handleSearchChange}
        >
          <select value={typeFilter} onChange={event => handleTypeChange(event.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="industry">Empresa</option>
            <option value="research">Investigación</option>
          </select>
        </Toolbar>

        <p>
          Mostrando {filteredApplications.length} de {applications.length}{' '}
          {applications.length === 1 ? 'candidatura' : 'candidaturas'}
        </p>

        <section className="table-container">
          <ApplicationsTable
            applications={paginatedApplications}
            onStatusChange={(id, status) => update(id, { status })}
            onOpenNote={setNoteApplication}
            onOpenDetail={setSelectedApplication}
          />
        </section>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </main>
      {noteApplication && (
        <NoteForm
          item={noteApplication}
          onSave={handleSaveNote}
          onCancel={() => setNoteApplication(null)}
        />
      )}

      {selectedApplication && (
        <RecordDetails
          item={selectedApplication}
          kind="application"
          isStale={staleItems.some(item => item.id === selectedApplication.id)}
          onClose={() => setSelectedApplication(null)}
          onSuspend={async id => {
            await suspend(id);
            setSelectedApplication(null);
          }}
          onEdit={item => {
            setSelectedApplication(null);
            setEditingApplication(item);
          }}
          onEditNotes={item => {
            setSelectedApplication(null);
            setNoteApplication(item);
          }}
          onDelete={handleDelete}
        />
      )}

      {editingApplication && (
        <RecordEditForm
          item={editingApplication}
          kind="application"
          onSave={update}
          onClose={updatedItem => {
            setEditingApplication(null);
            setSelectedApplication(updatedItem ?? editingApplication);
          }}
        />
      )}

      {deletingApplication !== null && (
        <DeleteConfirm
          title="Eliminar candidatura"
          message="¿Quieres eliminar definitivamente esta candidatura? Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setDeletingApplication(null)}
        />
      )}
    </>
  );
}

export default Applications;
