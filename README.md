# Job Tracker

A small full-stack application for tracking job applications and professional contacts. The React interface lets you review and edit records, follow status and notes changes over time, while an Express API stores records using either local JSON files or MongoDB.

## Features

- Track job applications and professional contacts in the same dashboard.
- Create applications with a position, company, type, and country; city and contract details are optional. The frontend assigns the application date automatically.
- Manage contacts with a name, contact details, institution, and country; department and city are optional. The frontend assigns the contact date automatically.
- Search applications or contacts by different fields.
- Filter applications by type or status and contacts by status, with summary counts for both.
- Change record statuses from the table or edit dialog; the available next states are restricted by the status transition rules below.
- Browse results in pages of 10, sorted by application or contact date (newest first).
- Open full record details in a dedicated modal to review status, notes, dates, and contact information without leaving the list view.
- Edit application and contact details from the record view.
- Delete applications and contacts from the record view, with a confirmation dialog to prevent accidental deletion.
- Review a timeline of record creation and status or notes changes.
- Review pending applications/contacts that have been open for more than 30 days with a stale-items alert panel and suspend them directly from there.
- Add and edit notes for applications and contacts through dedicated modal windows.
- Persist data using either local JSON files or MongoDB.
- Run backend tests against both storage implementations.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Testing:** Node.js test runner, Vitest, React Testing Library
- **Code quality:** ESLint
- **Coverage:** c8 for the backend and Vitest's V8 coverage provider for the frontend
- **Storage:** Pluggable JSON-file and MongoDB backends

## Prerequisites

- Node.js version specified in `.nvmrc`.
- npm (included with Node.js).
- MongoDB, running locally, to run the backend tests with MongoDB storage.

## Getting started

Install dependencies for the root project, backend, and frontend:

```sh
npm run install:all
```

## Environment variables

Create a `.env` file in the project root. Vite and the API server read this shared file. For a default local setup, it can contain:

```env
VITE_LANGUAGE=es
STORAGE_TYPE=json
PORT=3001
```

| Variable              | Required         | Description                                                                                                                                         |
| --------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_LANGUAGE`       | No               | Frontend language: `es` or `en`. Defaults to `es`. This `VITE_` variable is included in the client bundle; do not put secrets in `VITE_` variables. |
| `STORAGE_TYPE`        | No               | Storage backend: `json` or `mongodb`. Defaults to `json`.                                                                                           |
| `PORT`                | No               | API server port. Defaults to `3001`.                                                                                                                |
| `JSON_DATA_DIR`       | No               | Directory for JSON data files. Defaults to `client/data`. Applies when using JSON storage.                                                          |
| `MONGODB_URI`         | Only for MongoDB | MongoDB connection string.                                                                                                                          |
| `MONGODB_DB`          | Only for MongoDB | MongoDB database name.                                                                                                                              |
| `RENDER_EXTERNAL_URL` | No               | Public frontend URL to allow for cross-origin API requests when deployed.                                                                           |
| `TEST_STORAGE_TYPE`   | Tests only       | Storage backend used by server tests; takes precedence over `STORAGE_TYPE`.                                                                         |

Backend tests load test-specific values from `server/.env.test`. The root `.env` is ignored by Git, so do not commit it.

Start the API and frontend together from the project root:

```sh
npm run dev
```

The API listens at [http://localhost:3001](http://localhost:3001). Open the local URL printed by Vite, usually [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the backend.

You can also run each part separately.

From the `server` directory:

```sh
npm start
```

Or start the backend in development mode, with automatic restarts on changes:

```sh
npm run dev
```

From the `client` directory:

```sh
npm run dev
```

## Available scripts

### From the project root

| Command                | Description                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run install:all`  | Install dependencies for the root, backend, and frontend.                                                                                                              |
| `npm run dev`          | Start the API and Vite development server concurrently.                                                                                                                |
| `npm run lint`         | Run ESLint on the backend and frontend.                                                                                                                                |
| `npm test`             | Run backend tests with JSON and MongoDB storage, followed by frontend tests. All suites run even if one fails, and the command exits with an error if any suite fails. |
| `npm run test:json`    | Run backend tests using JSON storage.                                                                                                                                  |
| `npm run test:mongodb` | Run backend tests using MongoDB storage.                                                                                                                               |
| `npm run test:client`  | Run frontend tests with Vitest and coverage.                                                                                                                           |
| `npm run build`        | Build the frontend for production in `client/dist`.                                                                                                                    |

### From `client`

| Command           | Description                                     |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Start the Vite development server.              |
| `npm run build`   | Build the frontend for production.              |
| `npm run preview` | Preview the production build locally.           |
| `npm run lint`    | Run ESLint on the frontend.                     |
| `npm test`        | Run Vitest tests and generate coverage reports. |

### From `server`

| Command        | Description                                       |
| -------------- | ------------------------------------------------- |
| `npm start`    | Start the API server.                             |
| `npm run dev`  | Start the API with automatic restarts on changes. |
| `npm run lint` | Run ESLint on the backend.                        |
| `npm test`     | Run backend tests and generate coverage reports.  |

## Continuous integration

GitHub Actions runs the CI workflow on every pull request and every push to `master`.

The workflow:

- Checks out the repository.
- Requires a higher semantic version in `server/package.json` or `client/package.json` whenever files in the corresponding package change.
- Sets up the Node.js version specified in `.nvmrc`.
- Installs root, backend, and frontend dependencies using `npm ci`.
- Runs ESLint on the backend and frontend.
- Runs backend tests using JSON storage with temporary data files.
- Runs backend tests using MongoDB storage against a dedicated test database (`job_tracker_test`).
- Runs frontend tests using Vitest and its V8 coverage provider.
- Uploads coverage reports as a downloadable GitHub Actions artifact.
- Builds the frontend for production.

The MongoDB test service uses an isolated test database. Test configuration must never point to a production database or a database containing personal data.

Coverage artifacts are retained for 14 days. They can be downloaded from the **Artifacts** section of a completed workflow run.

The workflow uses read-only repository permissions and cancels superseded runs for the same branch or pull request.

The CI currently reports coverage but does not enforce minimum coverage thresholds.

## Data storage

The backend supports two storage implementations.

- **JSON:** Stores applications and contacts in `jobs.json` and `contacts.json` under `client/data` by default. On first read, the server creates the directory and any missing files with empty collections, without replacing existing files.
- **MongoDB:** Stores applications and contacts in separate collections and uses a counter collection to generate numeric record IDs.

JSON tests use temporary data files so they do not modify your regular application data.

MongoDB tests must use a dedicated test database, such as `job_tracker_test`, and must never run against a database containing production or personal data.

Back up JSON files or your MongoDB database before manually changing or replacing stored data.

### Applications

Application records are stored in the `applications` collection when using MongoDB, or in `jobs.json` when using JSON storage. The JSON file contains an object with an `applications` array.

A record can contain the following fields:

| Field            | Description                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`             | Numeric record identifier.                                                                                             |
| `company`        | Company or organization. Required.                                                                                     |
| `position`       | Job title. Required.                                                                                                   |
| `type`           | Application type: `industry` or `research`. Required.                                                                  |
| `country`        | Country. Required.                                                                                                     |
| `city`           | City. Optional.                                                                                                        |
| `appliedAt`      | Application timestamp in ISO 8601 format; the table displays only `YYYY-MM-DD`.                                        |
| `durationType`   | Contract type: `fixed` or `indefinite`. Optional.                                                                      |
| `durationMonths` | Positive integer for a `fixed` contract; otherwise `null`.                                                             |
| `notes`          | Free-text notes or follow-up comments. Optional.                                                                       |
| `status`         | `pending`, `interview`, `offer`, `accepted`, `declined`, `rejected`, or `suspended`. New records default to `pending`. |
| `updatedAt`      | Server-managed ISO 8601 timestamp for the most recent change.                                                          |
| `history`        | Server-managed list of status and notes changes, with the old value, new value, and change timestamp.                  |

Example `jobs.json`:

```json
{
  "applications": [
    {
      "id": 1,
      "appliedAt": "2026-10-01T09:30:15.123Z",
      "company": "Example Company",
      "position": "Software Engineer",
      "type": "industry",
      "country": "España",
      "city": "Madrid",
      "durationType": "fixed",
      "durationMonths": 12,
      "notes": "",
      "status": "pending"
    }
  ]
}
```

When using JSON storage, use a top-level `applications` array. Each entry should have a unique numeric `id`, non-empty `company`, `position`, `type`, and `country`, an `appliedAt` timestamp in ISO 8601 format, and a valid status. Applications are sorted by `appliedAt`; the table displays only its date portion (`YYYY-MM-DD`). Optional text fields can be empty strings. A fixed duration requires a positive integer `durationMonths`; use `null` when no duration applies.

When creating an application through the frontend, the current timestamp is assigned automatically. The API also requires `appliedAt` in ISO 8601 format. The server generates the record `id`.

### Contacts

Contact records are stored in the `contacts` collection when using MongoDB, or in `contacts.json` when using JSON storage. The JSON file contains an object with a `contacts` array.

A record can contain the following fields:

| Field         | Description                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`          | Numeric record identifier.                                                                                            |
| `contact`     | Contact person's name. Required.                                                                                      |
| `email`       | Email address or other contact detail. Required.                                                                      |
| `institution` | Company, university, or institution. Required.                                                                        |
| `department`  | Department or laboratory. Optional.                                                                                   |
| `city`        | City. Optional.                                                                                                       |
| `country`     | Country. Required.                                                                                                    |
| `contactedAt` | First-contact timestamp in ISO 8601 format; the table displays only `YYYY-MM-DD`.                                     |
| `status`      | `pending`, `in_conversation`, `follow_up`, `completed`, `rejected`, or `suspended`. New records default to `pending`. |
| `notes`       | Free-text notes or follow-up comments. Optional.                                                                      |
| `updatedAt`   | Server-managed ISO 8601 timestamp for the most recent change.                                                         |
| `history`     | Server-managed list of status and notes changes, with the old value, new value, and change timestamp.                 |

Example `contacts.json`:

```json
{
  "contacts": [
    {
      "id": 1,
      "contact": "Ana García",
      "email": "ana@example.com",
      "institution": "Acme Labs",
      "department": "Research",
      "city": "Madrid",
      "country": "España",
      "contactedAt": "2026-10-02T14:45:30.456Z",
      "status": "pending",
      "notes": "Asked for a meeting next week."
    }
  ]
}
```

When using JSON storage, use a top-level `contacts` array. Each entry should have a unique numeric `id`, non-empty `contact`, `email`, `institution`, and `country`, a `contactedAt` timestamp in ISO 8601 format, and a valid status. Contacts are sorted by `contactedAt`; the table displays only its date portion (`YYYY-MM-DD`). Optional text fields can be empty strings.

When creating a contact through the frontend, the current timestamp is assigned automatically. The API also requires `contactedAt` in ISO 8601 format. The server generates the record `id`.

Omit `id` when creating records through the API; the server generates it. The `notes` field may be an empty string.

New records start with an empty `history`. The API updates `updatedAt` whenever a record changes and appends history entries for changes to `status` or `notes`. The detail view builds the creation event from `appliedAt` or `contactedAt`; older records without history remain readable.

## API

The API runs at [http://localhost:3001](http://localhost:3001). The frontend accesses it through the Vite proxy at `/api`.

Interactive API documentation is available at [http://localhost:3001/api-docs/](http://localhost:3001/api-docs/), and the OpenAPI specification is available at [http://localhost:3001/api-docs.json](http://localhost:3001/api-docs.json).

Invalid input, including malformed JSON, empty update payloads, and dates that do not exist (such as `2026-02-31`), returns `400`. Unknown record IDs return `404`. Invalid application or contact status transitions return `409`. Attempts to suspend a record that is not pending or is not older than 30 days return `400`; a concurrent change during suspension can return `409`. Requests from origins other than `http://localhost:3000` and `http://localhost:5173` return `403`. JSON request bodies larger than the configured limit return `413`. API errors are returned as JSON objects containing a `message` field and optional `description` and `details` entries.

### Health

| Method | Endpoint  | Description                             |
| ------ | --------- | --------------------------------------- |
| `GET`  | `/health` | Return `200` with `{ "status": "ok" }`. |

### Applications

| Method   | Endpoint                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/applications`             | Return `{ "applications": [...] }`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST`   | `/api/applications`             | Create an application. Requires `company`, `position`, `type` (`industry` or `research`), `country`, and `appliedAt` as a UTC ISO 8601 timestamp. Other text fields are optional. `durationType` may be empty, `fixed`, or `indefinite`; for `fixed`, `durationMonths` may be omitted or `null`, or be a positive integer. Status may be `pending`, `interview`, `offer`, `accepted`, `declined`, or `rejected` and defaults to `pending`. |
| `PATCH`  | `/api/applications/:id`         | Partially update an application's details, status, or notes. Editable fields: `company`, `position`, `type`, `city`, `country`, `durationType`, `durationMonths`, `appliedAt`, `status`, and `notes`. Status changes must follow the server-validated transition flow; use the suspend endpoint for eligible pending applications.                                                                                                         |
| `GET`    | `/api/applications/old`         | Return pending applications older than 30 days.                                                                                                                                                                                                                                                                                                                                                                                            |
| `PATCH`  | `/api/applications/:id/suspend` | Suspend an eligible pending application older than 30 days. The response has status `suspended`.                                                                                                                                                                                                                                                                                                                                           |
| `DELETE` | `/api/applications/:id`         | Delete an application; returns `204` on success.                                                                                                                                                                                                                                                                                                                                                                                           |

### Contacts

| Method   | Endpoint                    | Description                                                                                                                                                                                                                                                                                                 |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/contacts`             | Return `{ "contacts": [...] }`.                                                                                                                                                                                                                                                                             |
| `POST`   | `/api/contacts`             | Create a contact. Requires `contact`, `email`, `institution`, `country`, and `contactedAt` as a UTC ISO 8601 timestamp. Status defaults to `pending`; accepted statuses are `pending`, `in_conversation`, `follow_up`, `completed`, and `rejected`.                                                         |
| `PATCH`  | `/api/contacts/:id`         | Partially update a contact's details, status, or notes. Editable fields: `contact`, `email`, `institution`, `department`, `city`, `country`, `contactedAt`, `status`, and `notes`. Status changes must follow the server-validated transition flow; use the suspend endpoint for eligible pending contacts. |
| `GET`    | `/api/contacts/old`         | Return pending contacts older than 30 days.                                                                                                                                                                                                                                                                 |
| `PATCH`  | `/api/contacts/:id/suspend` | Suspend an eligible pending contact older than 30 days. The response has status `suspended`.                                                                                                                                                                                                                |
| `DELETE` | `/api/contacts/:id`         | Delete a contact; returns `204` on success.                                                                                                                                                                                                                                                                 |

Example contact update request:

```json
{
  "status": "in_conversation",
  "notes": "Followed up"
}
```

Contact status transitions are:

| Current status    | Allowed next statuses                                   |
| ----------------- | ------------------------------------------------------- |
| `pending`         | `in_conversation`, `follow_up`, `rejected`, `suspended` |
| `in_conversation` | `follow_up`, `completed`, `rejected`, `suspended`       |
| `follow_up`       | `pending`                                               |
| `suspended`       | `in_conversation`, `follow_up`, `rejected`              |
| `completed`       | None                                                    |
| `rejected`        | None                                                    |

A status change outside this table returns `409 Conflict`.

Application status transitions are:

| Current status | Allowed next statuses                |
| -------------- | ------------------------------------ |
| `pending`      | `interview`, `rejected`, `suspended` |
| `interview`    | `offer`, `declined`, `rejected`      |
| `offer`        | `accepted`, `declined`               |
| `suspended`    | `interview`, `rejected`              |
| `accepted`     | None                                 |
| `declined`     | None                                 |
| `rejected`     | None                                 |

A status change outside this table returns `409 Conflict`.

The table status controls and the record edit dialog expose only the allowed next statuses for the current record. A record with no allowed next statuses is shown with its status field disabled.

The API allows browser requests from `http://localhost:3000` and `http://localhost:5173`. Requests from other origins receive `403`.

Writes are serialized and atomic in JSON storage. MongoDB storage uses database operations to persist records.

## Project structure

```text
.
├── package.json                    Root scripts for development, lint, tests and build
├── client/                          React frontend (Vite)
│   ├── data/                        Ignored local JSON data, created as needed
│   └── src/
│       ├── app/                     Application composition and app-level tests
│       ├── features/
│       │   ├── applications/        Application view, table and feature tests
│       │   └── contacts/            Contact view, notes, table and feature tests
│       ├── lib/                     Shared record field
│       ├── shared/
│       │   ├── api/                 API request helper and tests
│       │   ├── components/          UI components shared across features, including status selectors and timelines
│       │   ├── hooks/               Collection and pagination hooks with tests
│       │   └── lib/                 Shared constants, utilities and tests
│       ├── test/                    Vitest setup and reusable test helpers
│       ├── main.jsx                 Browser entry point
│       └── *.css                    Global styles
└── server/                          Express API
    ├── server.js                    Process startup and shutdown
    ├── src/
    │   ├── app.js                   Express app composition
    │   ├── domain/                  Validation, status transitions, record rules and HTTP errors
    │   ├── middleware/              Security and error handling
    │   ├── routes/                  Application and contact endpoints
    │   ├── storage/                 Storage factory and JSON/MongoDB adapters
    │   └── db.js                    MongoDB connection lifecycle
    └── test/
        ├── integration/             HTTP/API behavior tests
        └── unit/                    Database and storage factory tests
```

The frontend coverage reports are generated in `client/coverage/`. Backend coverage reports are generated by c8. Coverage directories are generated locally and should not be committed to Git.
