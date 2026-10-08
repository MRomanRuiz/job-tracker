# Job Tracker

A small full-stack application for tracking job applications and professional contacts. The React interface lets you review and update application and contact statuses, while an Express API stores the records in local JSON files.

## Features

- Track job applications and professional contacts in the same dashboard.
- Add applications with a company, position, location, type, application date, and status.
- Search applications by company, position, location, type, or field.
- Filter by application type or status and view summary counts.
- Browse results in pages of 10, sorted by application date (newest first).
- Review pending applications that have been open for more than 30 days and suspend them.
- Manage contacts with a name, center/company, date of contact, status, and personal notes.
- Search, filter, and paginate contacts, including notes-based searches.
- Add and edit notes for each contact through a dedicated modal window.
- Review stale pending contacts older than 30 days and suspend them automatically.
- Persist all data in local JSON files without requiring a database.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Storage:** `client/src/data/jobs.json` and `client/src/data/contacts.json`

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm

## Getting started

Install dependencies for both parts of the application:

```sh
cd server
npm install
cd ../client
npm install
```

Start the API from the project root in one terminal:

```sh
cd server
node server.js
```

The API listens at `http://localhost:3001`.

In a second terminal, start the frontend:

```sh
cd client
npm run dev
```

Open the local URL printed by Vite (by default, `http://localhost:5173`).

## Available scripts

Run these commands from the `client` directory:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the frontend for production in `client/dist`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint on the frontend. |

The backend currently has no npm start script; run it with `node server.js` from `server`.

## Data format

The application stores two JSON collections:

- `client/src/data/jobs.json` for job applications.
- `client/src/data/contacts.json` for contacts and notes.

### Applications

Application records are stored in `client/src/data/jobs.json` as an object with an `applications` array. A record can contain:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `company` | Company or organization. |
| `position` | Job title. |
| `location` | Job location. |
| `type` | Application type, such as `Empresa` or `Investigación`. |
| `appliedAt` | Application date in `YYYY-MM-DD` format. |
| `status` | `pending`, `interview`, `offer`, `rejected`, or `suspended`. |
| `field`, `duration`, `document` | Optional additional details. |

Create this file locally at `client/src/data/jobs.json` before starting the API. The server reads and writes it directly, and it is intentionally ignored by Git so personal application data is not committed. Back it up before manually changing or replacing its contents.

Example `jobs.json`:

```json
{
  "applications": [
    {
      "id": 1,
      "appliedAt": "2026-10-01",
      "company": "Example Company",
      "location": "Remote",
      "position": "Software Engineer",
      "duration": "Permanent",
      "type": "Empresa",
      "field": "Software Engineering",
      "status": "pending",
      "document": ""
    }
  ]
}
```

Use a top-level `applications` array. Each entry should have a unique numeric `id`, an `appliedAt` date in `YYYY-MM-DD` format, and a valid `status`. The other fields shown above can be empty strings when they do not apply. When creating an application through the API, omit `id`; the server generates it.

### Contacts

Contact records are stored in `client/src/data/contacts.json` as an object with a `contacts` array. A record can contain:

| Field | Description |
| --- | --- |
| `id` | Numeric record identifier. |
| `contact` | Contact person name. |
| `center` | Company or center name. |
| `contactedAt` | Date of first contact in `YYYY-MM-DD` format. |
| `status` | `pending`, `replied`, `rejected`, or `suspended`. |
| `notes` | Free-text notes or follow-up comments. |

Example `contacts.json`:

```json
{
  "contacts": [
    {
      "id": 1,
      "contact": "Ana García",
      "center": "Acme Labs",
      "contactedAt": "2026-10-02",
      "status": "pending",
      "notes": "Asked for a meeting next week."
    }
  ]
}
```

When creating or updating a contact through the API, omit `id`; the server generates it. The `notes` field may be empty.

## API

The frontend expects the API at `http://localhost:3001`.

### Applications

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/applications` | Return all applications. |
| `POST` | `/api/applications` | Create an application. The server assigns its ID. |
| `PATCH` | `/api/applications/:id` | Update a status (`pending`, `interview`, `offer`, or `rejected`). |
| `GET` | `/api/applications/old` | Return pending applications older than 30 days. |
| `PATCH` | `/api/applications/:id/suspend` | Suspend an eligible pending application older than 30 days. |

### Contacts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/contacts` | Return all contacts. |
| `POST` | `/api/contacts` | Create a contact. The server assigns its ID. Requires `contact`, `center`, `contactedAt`, and a valid `status` (`pending`, `replied`, or `rejected`). |
| `PATCH` | `/api/contacts/:id` | Update a contact status and/or notes. Accepts a JSON body such as `{ "status": "replied", "notes": "Followed up" }`. |
| `GET` | `/api/contacts/old` | Return pending contacts older than 30 days. |
| `PATCH` | `/api/contacts/:id/suspend` | Suspend an eligible pending contact older than 30 days. |

The API allows browser requests from `http://localhost:3000` and `http://localhost:5173`.

## Project structure

```text
client/
  src/
    components/         React UI components
    data/
      jobs.json         Local application data
      contacts.json     Local contact data and notes
    App.jsx             Main application and API integration
server/
  server.js             Express API
```
