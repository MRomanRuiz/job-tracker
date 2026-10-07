# Job Tracker

A small full-stack application for tracking job applications. The React interface lets you review and update application statuses, while an Express API stores the records in a local JSON file.

## Features

- Add applications with a company, position, location, type, application date, and status.
- Search applications by company, position, location, type, or field.
- Filter by application type or status and view summary counts.
- Browse results in pages of 10, sorted by application date (newest first).
- Review pending applications that have been open for more than 30 days and suspend them.
- Persist application data in a JSON file without requiring a database.

## Tech stack

- **Frontend:** React 19, Vite 8
- **Backend:** Node.js, Express 5
- **Storage:** `client/src/data/jobs.json`

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

## API

The frontend expects the API at `http://localhost:3001`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/applications` | Return all applications. |
| `POST` | `/api/applications` | Create an application. The server assigns its ID. |
| `PATCH` | `/api/applications/:id` | Update a status (`pending`, `interview`, `offer`, or `rejected`). |
| `GET` | `/api/applications/old` | Return pending applications older than 30 days. |
| `PATCH` | `/api/applications/:id/suspend` | Suspend an eligible pending application older than 30 days. |

The API allows browser requests from `http://localhost:3000` and `http://localhost:5173`.

## Project structure

```text
client/
  src/
    components/       React UI components
    data/jobs.json    Local application data
    App.jsx           Main application and API integration
server/
  server.js           Express API
```
