# Lattice

[![CI](https://github.com/D-Arijit57/Lattice/actions/workflows/ci.yml/badge.svg)](https://github.com/D-Arijit57/Lattice/actions/workflows/ci.yml)

A multi-tenant, headless content engine. Organizations define their own content types (Product, Event, Course, ...) at runtime by declaring fields, then create and read entries through a REST API. No code change or database migration is needed per content type.

**Live demo:** https://lattice-five-orcin.vercel.app

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-092E20?style=flat&logo=django&logoColor=white)
![Django REST Framework](https://img.shields.io/badge/DRF-A30000?style=flat&logo=django&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=githubactions&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat&logo=supabase&logoColor=black)

## Contents

- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Architecture](#architecture)
- [Testing and CI](#testing-and-ci)
- [Deployment](#deployment)
- [Security](#security)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)

## How it works

| Concept | What it is |
|---|---|
| **Organization** | An isolated tenant. A user can belong to many; every request is scoped to one and checked against the caller's membership. |
| **Content type** | A kind of content (`name`, `slug`) that owns a set of **fields** (`string`, `number`, `boolean`, `date`, optionally required). |
| **Version** | An immutable JSON Schema generated from a content type's fields. Publishing a new version never changes an old one. |
| **Entry** | The actual data, stored as JSONB, validated against the schema of the version it was created under, and pinned to that version. |
| **API key** | A read-only credential an organization issues so an outside app can fetch its content without a user login. |

Validation errors are returned per field, all at once:

```json
{ "data": { "price": ["Must be a number."], "sku": ["This field is required."] } }
```

![Data model](docs/data-model.png)

`users` and `organizations` are many-to-many through `organization_memberships` (unique per user and organization). An organization owns `content_types` and `api_keys`; a content type owns `fields` and `content_type_versions`; an `entry` references a version, not the content type directly.

## Quick start

Requirements: Python 3.11+, Node.js 18+ (CI uses 20), and a PostgreSQL database.

**Backend**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # edit SECRET_KEY and DATABASE_URL
python manage.py migrate
python manage.py runserver        # http://localhost:8000
```

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env              # VITE_API_BASE_URL=http://localhost:8000/api
npm run dev                       # http://localhost:3000
```

Other frontend scripts: `npm run build`, `npm run preview`, `npm run lint` (type-check).

**Full stack in Docker (optional).** `docker-compose.yml` builds the backend and an nginx container that serves the SPA on `http://localhost:8080` and proxies `/api` to the backend. It has no bundled database: copy the root `.env.example` to `.env` and set `DATABASE_URL` to a Postgres you can reach.

```bash
docker compose up --build
```

## Configuration

**Backend** (`backend/.env`, or real environment variables in production)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret and JWT signing key. Required. Use a unique value of 32+ characters per environment. |
| `DEBUG` | `True` for local development. Must be `False` in production: it turns on HTTPS redirect, `Secure` cookies and HSTS. Default `False`. |
| `ALLOWED_HOSTS` | Comma-separated hostnames the API will serve, e.g. `localhost,127.0.0.1`. |
| `DATABASE_URL` | Postgres URL, e.g. `postgres://user:password@localhost:5432/lattice`. Percent-encode special characters in the password. Required. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins. Needed only when the SPA and API are on different origins (local dev). |
| `DB_CONN_MAX_AGE` | Seconds to keep a Postgres connection open between requests. Default `0`. Set it (e.g. `60`) when the database is remote; it avoids a connection handshake per request. |
| `NUM_PROXIES` | Number of reverse proxies in front of Django, used to read the real client IP for rate limiting. `0` locally. |
| `LOG_LEVEL` | `DEBUG`, `INFO` (default), `WARNING` or `ERROR`. Logs go to stdout. |

**Frontend** (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | API base URL. `http://localhost:8000/api` in development; `/api` in production, where the SPA and API share one origin. Falls back to `/api` if unset. Vite inlines it at build time. |

## API reference

All routes are under `/api/`, use JSON, and return standard DRF error bodies (`{"detail": "..."}` or per-field errors). Reads and creates are available everywhere; entries can also be edited, and entries, fields, content types and organizations can be archived (soft delete). Which role may call what is under [Roles](#roles).

| Area | Endpoints |
|---|---|
| Auth | `POST auth/signup/`, `POST auth/login/`, `POST auth/refresh/`, `POST auth/logout/`, `GET auth/me/` |
| Organizations | `GET, POST organizations/`, `GET, DELETE organizations/{org}/` (delete is owner only). Responses include `my_role`. |
| Content types | `GET, POST organizations/{org}/content-types/`, `GET .../content-types/{ct}/` |
| Fields | `GET, POST .../content-types/{ct}/fields/`, `GET .../fields/{id}/` |
| Versions | `GET, POST .../content-types/{ct}/versions/`, `GET .../versions/{id}/` |
| Entries | `GET, POST .../content-types/{ct}/entries/`, `GET .../entries/{id}/` |
| API keys | `GET, POST organizations/{org}/api-keys/`, `DELETE organizations/{org}/api-keys/{id}/` (revoke). Admin and owner only. |
| Members | `GET organizations/{org}/members/`, `PATCH, DELETE .../members/{id}/`, `POST .../members/{id}/transfer-ownership/`, `GET organizations/{org}/user-search/?q=` |
| Invitations | `GET, POST organizations/{org}/invitations/`, `DELETE .../invitations/{id}/` (cancel); for the invitee: `GET invitations/`, `POST invitations/{id}/accept/`, `POST invitations/{id}/decline/` |
| Publish requests | `GET, POST .../content-types/{ct}/publish-requests/`, `GET, DELETE .../publish-requests/{id}/`, `POST .../publish-requests/{id}/approve/` and `/reject/` |
| Notifications | `GET notifications/`, `GET notifications/unread-count/`, `POST notifications/{id}/read/`, `POST notifications/read-all/` |
| Delivery (API key) | `GET delivery/content-types/` (discover), `GET delivery/content-types/{slug}/` (latest fields), `GET delivery/content-types/{slug}/entries/`, `GET delivery/content-types/{slug}/entries/{id}/` |
| Health | `GET monitoring/health/` (runs `SELECT 1`; `200` healthy, `503` database unreachable) |

Exact request and response shapes are in [`API-Contract.md`](API-Contract.md).

**Authentication.** `POST auth/login/` sets two httpOnly cookies: `access_token` (15 minutes, sent on every request) and `refresh_token` (7 days, scoped to `/api/auth/refresh/` only). Both are `SameSite=Lax` and `Secure` when `DEBUG=False`. Clients must send credentials (`fetch(..., { credentials: "include" })`). The bundled frontend retries a request once after a `401` by calling `auth/refresh/`.

**Tenancy.** Organization-scoped routes check the caller's membership: a non-member gets `403`, an organization that does not exist gets `404`, and the organization list and detail routes only ever return organizations the caller belongs to.

## Roles

Every member has one role per organization. A higher role can do everything a lower one can.

| Role | Can |
|---|---|
| **Viewer** | Read content types, fields, versions and entries. |
| **Editor** | Also create, edit, archive and restore entries, and add or archive fields (fields are the draft schema). Can ask for a schema version to be published. |
| **Admin** | Also create and archive content types, publish a version directly or approve an editor's publish request, manage API keys, invite and remove members. |
| **Owner** | Also change roles, hand over ownership and delete the organization. Exactly one per organization. |

The API enforces this: a role that is too low gets `403 {"detail": "Your role does not allow this action."}`, checked before the request body is validated. The web app also hides the buttons a role cannot use.

**Publishing.** An editor's field changes stay a draft until a version is published. The editor sends a *publish request* from the Versions tab; an admin or owner sees what would change (added, removed and changed fields), then approves, which publishes the next version, or rejects with a reason. Existing entries stay on the version they were saved under.

**Members.** Admins and the owner find registered users with the search on the Members page and invite them as viewer, editor or admin. The invitee accepts on their account page (or from the notification bell), and only then becomes a member. A new hire therefore has to sign up first. Notifications are in-app only; there is no email.

**Pagination.** Entry lists use cursor pagination: 50 per page, newest first, stable under inserts. Follow the `next` URL in the response.

**Example flow**

```text
POST /api/organizations/                            {"name": "Acme"}
POST /api/organizations/1/content-types/            {"name": "Product", "slug": "product"}
POST /api/organizations/1/content-types/1/fields/    {"name": "title", "data_type": "string", "required": true}
POST /api/organizations/1/content-types/1/fields/    {"name": "price", "data_type": "number", "required": true}
POST /api/organizations/1/content-types/1/versions/  {}        # generates the JSON Schema from the fields
POST /api/organizations/1/content-types/1/entries/   {"data": {"title": "Shirt", "price": 499}}
```

The generated schema for that content type:

```json
{
  "type": "object",
  "properties": { "title": { "type": "string" }, "price": { "type": "number" } },
  "required": ["title", "price"],
  "additionalProperties": false
}
```

**Delivery API.** Create a key under an organization (the raw `lat_...` key is returned once, only its SHA-256 hash is stored), then read content without a login:

```bash
curl https://lattice-five-orcin.vercel.app/api/delivery/content-types/product/entries/ \
  -H "Authorization: Bearer lat_<your key>"
```

The key carries its organization, so the URL uses the content type slug and no organization id. Revoked keys are rejected.

Consumers can discover what to read: `GET /api/delivery/content-types/` returns `[{name, slug}]` for the key's organization, and `GET /api/delivery/content-types/<slug>/` returns `{name, slug, version_number, fields: [{name, data_type, required}]}` from the latest published version (`fields` is empty and `version_number` null if none is published). Both are read-only and use the same key, throttle and org scoping.

**Rate limits** (per minute): login 5, signup 5, token refresh 30, authenticated user 100, delivery 60 per API key.

## Architecture

```text
Browser ──> Vercel (static SPA + api/proxy.ts) ──> Render (Docker: Gunicorn + Django) ──> Supabase Postgres
```

- **Single origin.** The browser only talks to the Vercel domain. A rewrite sends every `/api/*` request to one function, `frontend/api/proxy.ts`, which forwards method, headers, body and `Set-Cookie` to the backend. This keeps the auth cookies first-party and removes CORS from production.
- **Backend.** `backend/Dockerfile` runs `entrypoint.sh`, which applies migrations and then starts Gunicorn. Business rules live in `backend/content/services/` (schema generation, versioning, entry validation); DRF views and serializers in `backend/api/` stay thin.
- **Database.** Postgres with JSONB for entries and database-level unique constraints for tenancy-sensitive tables.
- **Region.** Backend, proxy function and database are all in Singapore. Moving the backend next to the database and reusing connections (`DB_CONN_MAX_AGE`) cut health-check latency from about 1.5 s to about 0.2 s.

## Testing and CI

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

275 tests cover auth, tenancy checks, roles, members and invitations, publish requests, notifications, content types, fields, schema generation, versioning, entry validation, API key management and the delivery API. Django creates and drops a temporary test database.

Tests always run on a **local** Postgres: `pytest.ini` selects `content_engine/settings_test.py`, which reads `TEST_DATABASE_URL` (default `postgres://localhost:5432/lattice_test`) and refuses a non-local host. Against the hosted database the suite took about 9 minutes and left sessions behind that broke the next run; locally it takes about 50 seconds. Create the database once with `createdb lattice_test`.

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:

- **backend:** Python 3.11, a `postgres:16` service container, `pytest`.
- **frontend:** Node 20, `npm ci`, `npm run lint` (type-check), `npm run build`.

## Deployment

| Piece | Host | Notes |
|---|---|---|
| Frontend + `/api` proxy | Vercel | Root directory `frontend`. `vercel.json` pins the function region and rewrites `/api/*` to `api/proxy.ts`; all other paths fall back to `index.html`. |
| Backend | Render (Docker, free) | Defined in `render.yaml`. Secrets are set in the Render dashboard, not committed. Health check path `/api/monitoring/health/`. |
| Database | Supabase Postgres | Use the Session pooler URL for `DATABASE_URL`. |
| Uptime | External monitor | Pings the health endpoint every 5 minutes so the free instance stays awake and the database stays active. |

Production environment on Render: `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS` (the `*.onrender.com` host), `DEBUG=False`, `DB_CONN_MAX_AGE=60`, `NUM_PROXIES`. To move the backend to another host, change `BACKEND_ORIGIN` in `frontend/api/proxy.ts` and keep the same `SECRET_KEY` so existing sessions stay valid.

Vercel and Render redeploy from `master` automatically.

## Security

- JWTs live only in httpOnly cookies; the refresh cookie is scoped to the refresh endpoint.
- API keys are random (`secrets.token_urlsafe(32)`), stored as SHA-256 hashes, revocable, and read-only.
- Membership checks on every organization-scoped route, then role checks before the request body is validated.
- Throttling on auth, user and delivery routes; the health endpoint is exempt so probes are never rate limited.
- With `DEBUG=False`: HTTPS redirect, `Secure` cookies and HSTS are enabled, and Django trusts `X-Forwarded-Proto` from the proxy.
- Logs avoid credentials: a failed login records only the client IP, and no tokens, cookies or request bodies are logged.

## Project structure

```text
backend/
  content_engine/    Django settings, root URLs, WSGI
  accounts/          User, Organization, OrganizationMembership, APIKey models
  content/           ContentType, Field, ContentTypeVersion, Entry models
  content/services/  schema_generation, versioning, entry_validation
  api/               DRF views, serializers, URLs: auth, accounts, content, delivery, monitoring
frontend/
  src/               React app (pages, components, lib/api.ts client)
  api/proxy.ts       Vercel function forwarding /api/* to the backend
  vercel.json        Rewrites and function region
docs/                Data model diagram
.github/workflows/   CI
render.yaml          Render service definition
docker-compose.yml   Local full-stack run
```

## Known limitations

- Rate-limit counters live in each Gunicorn worker's memory, so with several workers the effective limit is higher than configured. A shared cache (Redis) would fix this.
- No server-side token revocation yet: a leaked access token stays valid until it expires (15 minutes).
- Forgot-password and GitHub/Google/Microsoft sign-in appear in the UI as "coming soon" and are not implemented.
- Entries cannot be filtered or searched by field values, and fields cannot be renamed or edited (only archived).
- On the free hosting tiers the CPU is small, so login and signup take 1-2 seconds because of password hashing.
