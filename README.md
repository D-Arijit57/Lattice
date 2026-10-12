# Lattice

[![CI](https://github.com/D-Arijit57/Lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/D-Arijit57/Lattice/actions/workflows/ci.yml)

**Live demo:** https://lattice-five-orcin.vercel.app

A composable, multi-tenant content engine. Organizations define their own content types (Product, Event, Course, ...) at runtime by declaring fields, then store and query entries through a REST API. No code change or database migration is needed per content type.

## How it works

- **Organizations** are isolated tenants. A user can belong to many organizations, and every request is scoped to one and checked against the caller's membership.
- **Content types** describe a kind of content (`name`, `slug`) and own a set of **fields** (`string`, `number`, `boolean`, `date`, optionally required).
- **Versions** are immutable JSON Schema snapshots generated from a content type's fields. Publishing a new version never alters an old one.
- **Entries** hold the actual data as JSONB, are validated against the schema of the version they were created under, and stay pinned to that version.

Validation errors are returned per field, all at once:

```json
{ "data": { "price": ["Must be a number."], "sku": ["This field is required."] } }
```

## Data model

![Lattice data model](docs/data-model.png)

- `users` and `organizations` are linked many-to-many through `organization_memberships`.
- Each organization owns many `content_types`, and each content type owns many `fields`.
- `content_type_versions` store the generated JSON Schema for a content type, numbered per content type.
- `entries` keep their data as JSONB and reference a `content_type_version`, not the content type directly.
- Each organization can issue `api_keys` - read-only credentials (`hashed_key`, revocable via `revoked_at`) that let an external app fetch that organization's content without a logged-in user.

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.11, Django 5.2, Django REST Framework, PostgreSQL, `jsonschema` |
| Auth | JWT (`djangorestframework-simplejwt`) in httpOnly cookies |
| Serving | Gunicorn |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS, React Router |
| Tests / CI | pytest, pytest-django, GitHub Actions (Postgres service container) |
| Hosting | Vercel (SPA + `/api` proxy function), Render (Docker, Singapore), Supabase Postgres (Singapore) |

## Architecture and deployment

```
Browser -> Vercel (static SPA + api/proxy.ts function) -> Render (Docker, Gunicorn + Django) -> Supabase Postgres
```

- The browser only talks to one origin. Vercel serves the built SPA and rewrites every `/api/*` request to a small function (`frontend/api/proxy.ts`) that forwards it to the Render backend, including cookies. This keeps the httpOnly auth cookies first-party and removes the need for CORS in production.
- The backend runs from `backend/Dockerfile`; the entrypoint applies migrations before Gunicorn starts. `render.yaml` describes the service, and secrets are entered in the Render dashboard rather than committed.
- The backend and database are both in Singapore. Moving the backend next to the database, plus reusing Postgres connections (`DB_CONN_MAX_AGE`), cut the health-check latency from about 1.5 s to about 0.2 s.
- `docker-compose.yml` and `frontend/nginx.conf` are for running the full stack locally; production does not use nginx.
- An uptime monitor pings `GET /api/monitoring/health/` every 5 minutes, which keeps the free Render instance awake and the database active.
- CI (`.github/workflows/ci.yml`) runs the backend tests against a throwaway Postgres container and type-checks and builds the frontend on every push and pull request. Vercel and Render deploy from `master` on their own.

## Repository layout

```
backend/                  Django + DRF API
frontend/                 Vite + React control plane
frontend/api/proxy.ts     Vercel function that forwards /api/* to the backend
.github/workflows/        CI (tests, type-check, build)
render.yaml               Render service definition
```

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A running PostgreSQL database

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then edit the values, see "Configuration"
python manage.py migrate
python manage.py runserver  # http://localhost:8000
```

To serve with Gunicorn instead of the dev server:

```bash
gunicorn content_engine.wsgi
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:3000
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint` (type-check).

## Configuration

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key. Generate a unique value per environment. |
| `DEBUG` | `True` for local development, `False` in production. With `False`, cookies are marked `Secure`. |
| `ALLOWED_HOSTS` | Comma-separated list of hostnames the API will serve. |
| `DATABASE_URL` | Postgres connection string, e.g. `postgres://user:password@localhost:5432/lattice`. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of frontend origins allowed to call the API. |
| `LOG_LEVEL` | Minimum level written to the logs: `DEBUG`, `INFO`, `WARNING` or `ERROR`. Defaults to `INFO`. |
| `DB_CONN_MAX_AGE` | Seconds to keep a Postgres connection open between requests. Defaults to `0` (close after each request); set it (e.g. `60`) on a host where the database is remote. |
| `NUM_PROXIES` | Number of reverse proxies in front of the API, used to find the real client IP for rate limiting. `0` for local development. |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the API. `http://localhost:8000/api` in dev; `/api` (relative) in production, where the built SPA and the API share one host (see `frontend/.env.production.example`). Falls back to `/api` when unset. |

## Running the tests

```bash
cd backend
pip install -r requirements-dev.txt   # includes requirements.txt
pytest
```

Tests run against a temporary Postgres database that Django creates and drops automatically. Point `DATABASE_URL` at a local Postgres rather than a hosted one: against a remote database the suite takes minutes instead of seconds. CI does this on every push.

## API overview

All routes are under `/api/`. Requests and responses are JSON. Authentication uses two httpOnly cookies set on login, so clients must send credentials with each request (`credentials: 'include'`).

| Area | Endpoints |
|---|---|
| Auth | `POST auth/signup/`, `POST auth/login/`, `POST auth/refresh/`, `POST auth/logout/`, `GET auth/me/` |
| Organizations | `GET, POST organizations/`, `GET organizations/{org}/` |
| Content types | `GET, POST organizations/{org}/content-types/`, `GET .../content-types/{ct}/` |
| Fields | `GET, POST .../content-types/{ct}/fields/`, `GET .../fields/{id}/` |
| Versions | `GET, POST .../content-types/{ct}/versions/`, `GET .../versions/{id}/` |
| Entries | `GET, POST .../content-types/{ct}/entries/`, `GET .../entries/{id}/` |
| API keys | `GET, POST organizations/{org}/api-keys/`, `DELETE organizations/{org}/api-keys/{id}/` (revoke) |
| Delivery (API key) | `GET delivery/content-types/{slug}/entries/`, `GET delivery/content-types/{slug}/entries/{id}/` |
| Health | `GET monitoring/health/` |

Entry lists are cursor-paginated (50 per page, newest first). Example flow:

```bash
# 1. Create an organization, then a content type inside it
POST /api/organizations/                        {"name": "Acme"}
POST /api/organizations/1/content-types/        {"name": "Product", "slug": "product"}

# 2. Define fields
POST /api/organizations/1/content-types/1/fields/   {"name": "title", "data_type": "string", "required": true}
POST /api/organizations/1/content-types/1/fields/   {"name": "price", "data_type": "number", "required": true}

# 3. Publish a version (generates the JSON Schema from the fields)
POST /api/organizations/1/content-types/1/versions/ {}

# 4. Create entries, validated against the latest version
POST /api/organizations/1/content-types/1/entries/  {"data": {"title": "Shirt", "price": 499}}
```

### Delivery API

External apps read an organization's content with a read-only API key instead of a login. Create a key in the app, then:

```bash
curl https://lattice-five-orcin.vercel.app/api/delivery/content-types/product/entries/ \
  -H "Authorization: Bearer lat_<your key>"
```

Keys carry their organization, so the URL uses the content type's slug and no organization id. They are stored hashed (SHA-256), can be revoked, and are limited to 60 requests per minute each.

## Known limitations

- Rate-limit counters live in each Gunicorn worker's memory, so with several workers the effective limit is higher than configured. A shared cache (Redis) would fix this.
- Access tokens last 15 minutes and refresh tokens 7 days; there is no server-side token revocation yet.
- Forgot-password and GitHub/Google/Microsoft sign-in are shown in the UI as "coming soon" and are not implemented.
- The free hosting tiers are slow to wake and have small CPUs: login and signup take 1-2 seconds because of password hashing.
- There are no frontend tests yet, and entries cannot be filtered by field values.

See [`API-Contract.md`](API-Contract.md) for exact request and response shapes and error formats.
