import { useMemo, useState } from 'react';
import { ALL_STATUSES, ITEMS_PER_PAGE } from '../../shared/lib/constants';
import { LABELS } from '../../shared/lib/labels';
import usePagination from '../../shared/hooks/usePagination';
import {
  countByStatus,
  formatDate,
  formatDateTime,
  matchesStatus,
  matchesText,
  sortByDateDesc,
} from '../../shared/lib/utils';
import ApplicationsTable from './ApplicationsTable';
import Pagination from '../../shared/components/Pagination';
import RecordForm from '../../shared/components/RecordForm';
import ItemsAlert from '../../shared/components/ItemsAlert';
import StatCards from '../../shared/components/StatCards';
import Toolbar from '../../shared/components/Toolbar';
import NoteForm from '../../shared/components/NoteForm';
import RecordDetails from '../../shared/components/RecordDetails';
import RecordEditForm from '../../shared/components/RecordEditForm';
import { getRecordCreateFields } from '../../lib/recordFields';
import DeleteConfirm from '../../shared/components/DeleteConfirm';
import ScheduleFollowUpModal from '../../shared/components/ScheduleFollowUpModal';

const APPLICATION_CREATE_FIELDS = getRecordCreateFields('application');
const REQUIRED_FORM_FIELDS = APPLICATION_CREATE_FIELDS.filter(field => field.required);
const OPTIONAL_FORM_FIELDS = APPLICATION_CREATE_FIELDS.filter(field => !field.required);

const STAT_ITEMS = [
  { status: ALL_STATUSES, label: LABELS.applications.stats.total },
  { status: 'pending', label: LABELS.applications.stats.pending },
  { status: 'interview', label: LABELS.applications.stats.interviews },
  { status: 'rejected', label: LABELS.applications.stats.rejected },
];

const renderStaleApplication = (application, alertType) => (
  <>
    <span className="stale-primary" title={application.company}>
      {application.company}
    </span>

    <span title={application.position}>{application.position}</span>

    <span>{LABELS.applicationTypes[application.type] || application.type}</span>

    <span className="stale-date">
      {alertType === 'scheduled'
        ? formatDateTime(application.scheduledAt)
        : formatDate(application.appliedAt)}
    </span>
  </>
);

function Applications({ collection, showForm, onCloseForm }) {
  const {
    items: applications,
    staleItems,
    create,
    update,
    suspend,
    remove,
    scheduledItems,
  } = collection;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState('');
  const [noteApplication, setNoteApplication] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [editingApplication, setEditingApplication] = useState(null);
  const [deletingApplication, setDeletingApplication] = useState(null);
  const [interviewApplication, setInterviewApplication] = useState(null);

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

  const handleStatusChange = (id, status) => {
    if (status === 'interview') {
      const application = applications.find(item => item.id === id);

      if (application) {
        setInterviewApplication(application);
      }

      return;
    }

    update(id, { status });
  };

  const handleScheduleInterview = async scheduledAt => {
    const updated = await update(interviewApplication.id, {
      status: 'interview',
      scheduledAt: new Date(scheduledAt).toISOString(),
    });

    if (!updated) {
      return false;
    }

    setInterviewApplication(null);
    return true;
  };

  const confirmDelete = async () => {
    if (await remove(deletingApplication)) {
      setSelectedApplication(null);
      setDeletingApplication(null);
    }
  };

  return (
    <>
      <ItemsAlert
        items={staleItems}
        scheduledItems={scheduledItems}
        singularLabel={LABELS.applications.pendingSingular}
        pluralLabel={LABELS.applications.pendingPlural}
        itemType="application"
        renderCells={renderStaleApplication}
        onSuspend={suspend}
        onOpen={setSelectedApplication}
      />

      {showForm && (
        <div className="record-form-wrapper">
          <RecordForm
            title={LABELS.applications.newTitle}
            requiredFields={REQUIRED_FORM_FIELDS}
            optionalFields={OPTIONAL_FORM_FIELDS}
            submitLabel={LABELS.applications.save}
            onSubmit={handleCreate}
            onCancel={onCloseForm}
          />
        </div>
      )}

      <main>
        <StatCards items={statItems} activeStatus={statusFilter} onSelect={handleStatClick} />

        <Toolbar
          search={search}
          placeholder={LABELS.applications.searchPlaceholder}
          onSearchChange={handleSearchChange}
        >
          <select value={typeFilter} onChange={event => handleTypeChange(event.target.value)}>
            <option value="">{LABELS.applications.allTypes}</option>
            <option value="industry">{LABELS.applicationTypes.industry}</option>
            <option value="research">{LABELS.applicationTypes.research}</option>
          </select>
        </Toolbar>

        <p>
          {LABELS.applications.showing} {filteredApplications.length} {LABELS.pagination.of}{' '}
          {applications.length}{' '}
          {applications.length === 1 ? LABELS.applications.singular : LABELS.applications.plural}
        </p>

        <section className="table-container">
          <ApplicationsTable
            applications={paginatedApplications}
            onStatusChange={handleStatusChange}
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
          title={LABELS.applications.deleteTitle}
          message={LABELS.applications.deleteMessage}
          onConfirm={confirmDelete}
          onCancel={() => setDeletingApplication(null)}
        />
      )}

      {interviewApplication && (
        <ScheduleFollowUpModal
          item={interviewApplication}
          itemType="application"
          onSave={handleScheduleInterview}
          onCancel={() => setInterviewApplication(null)}
        />
      )}
    </>
  );
}

export default Applications;
