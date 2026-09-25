# Lattice

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

## Tech stack

| Layer | Tools |
|---|---|
| Backend | Python 3.11, Django 5.2, Django REST Framework, PostgreSQL, `jsonschema` |
| Auth | JWT (`djangorestframework-simplejwt`) in httpOnly cookies |
| Serving | Gunicorn |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS, React Router |
| Tests | pytest, pytest-django |

## Repository layout

```
backend/    Django + DRF API
frontend/   Vite + React control plane
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
| `NUM_PROXIES` | Number of reverse proxies in front of the API, used to find the real client IP for rate limiting. `0` for local development. |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the API, e.g. `http://localhost:8000/api`. |

## Running the tests

```bash
cd backend
pytest
```

Tests run against a temporary Postgres database that Django creates and drops automatically.

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

See [`API-Contract.md`](API-Contract.md) for exact request and response shapes, status codes, and error formats.
