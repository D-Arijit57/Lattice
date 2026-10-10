# Knowledge Transfer

Handoff for a new Claude session picking this project up cold, including after a rename.
Written 2026-10-07 on branch `master` (git was clean at the start of the session).

**How to use this file:** read it fully, then read the "Verify first" section before trusting any claim in "Current state". Anything marked *(unverified)* came from older notes and was not re-checked on the day this was written.

> The project is currently called **Lattice**. If it has been renamed, the code and docs below still apply; only the names change. See "If the project is renamed" at the end. Claude's auto-memory is keyed to the folder path, so a rename or move silently drops it.

---

## 1. Who you are working with

**Arijit Das** (`dasarijit5704@gmail.com`). Backend engineer, solo developer, building this as a learning-by-building portfolio project.

- Comfortable: Python, JS/Node/Express.
- New in 2026-08: Django, DRF, serious database design. About two months in now.
- **Has never written TypeScript.** The frontend (Vite + React 19 + TypeScript) was mostly written with Claude's help. Decided 2026-09-26 to learn TypeScript only **after deployment**.
- Pronouns not stated: use they/them.

### Learning style and working protocol

These come from Arijit's own statements and from `Progress-Audit.md`, `Decisions.md` and `Mistakes.md`. Follow them.

1. **Loop: propose, critique, implement, review.** Design is discussed before code is written. Alternatives are laid out with trade-offs, Arijit picks, then it is built, then reviewed.
2. **Socratic for design, direct for syntax.** On 2026-08-21 Arijit said *"write it, I'm not chasing syntax actually."* Ask guiding questions on design decisions and concepts. For mechanical or syntax slips, flag them and hand over the fix.
3. **Explicit over hidden framework behavior.** Preference recorded in Decision 58: plain `APIView`/hand-written URL routes (no routers), visible checks in code, no magic. Deviations (simplejwt, django-environ) were made knowingly and logged as named exceptions. Do not re-propose abandoned designs without new information (e.g. Decision 89: ViewSet vs APIView was tried both ways, ViewSet kept).
4. **Explain the "why" in plain words.** Every concept (JWT, SHA-256 vs PBKDF2, `select_for_update`, cursor pagination) is explained from first principles with a small example. Security details (hashing, one-time display, revocation) go slowly.
5. **Build, compare, decide.** Arijit likes trying two versions side by side before choosing. Respect the choice once made.
6. **Honest feedback, not cheerleading.** `Progress-Audit.md` is the model: state what improved and what is still shaky. Known soft spots: the create-vs-verify conflation (signup vs login), defaulting to "can you write it" for implementation, and mechanical Django/DRF slips when writing solo.
7. **Arijit raises design questions unprompted** and debugs from real output. Prefer asking "what does the output say?" before giving the answer.
8. **Ask what was unclear first.** When Arijit says a question was unclear, clarify before re-asking.
9. **Nothing committed or pushed without being asked.** Arijit commits themselves in most cases. Commit-message style so far: conventional-ish (`docs: ...`, `fix(docker): ...`).

### TypeScript rule (until deployment is done)

When touching `frontend/`: explain types, generics (`useApi<T>`, `request<T>`) and narrowing in plain words with a small example. Keep types simple. Never suggest rewriting to JS. After deployment, offer the guided walkthrough of `src/types/index.ts`, `src/lib/api.ts` and `src/lib/use-api.ts` (ask what each line means first, then correct).

### Documentation habits (keep them going)

| File | Purpose |
|---|---|
| `Decisions.md` | Numbered architectural decisions (up to **122** as of this writing). Format: What / Why / Why this only / Can we choose other ones. Superseded decisions are annotated, not deleted. |
| `Mistakes.md` | Arijit's own conceptual mistakes and the fix, numbered. |
| `gap.md` | Known gaps between what the system appears to do and what it guarantees. **Gitignored** (see Open items). |
| `bug.md` | Planted/found bugs. Referenced in Decisions 102 and 105. *(not re-read this session)* |
| `Auth-Audit.md`, `APIKey.md` | Learning notes written *before* implementing a feature. |
| `API-Contract.md` | Exact request/response shapes, verified live against a running server. |
| `Progress-Audit.md` | Honest progress review of Arijit as a builder (2026-09-13). |

Testing habits: assert each behavior at the lowest layer that can prove it. Check tests with **mutation checks** (deliberately break the code, confirm the right test fails). Rejection-path tests pin the reason (message or code), not only the status. Use `force_authenticate()` except in tests whose job is proving the auth gate (Decision 90).

---

## 2. The project

A composable, multi-tenant, headless content engine. Organizations define their own content types at runtime by declaring fields, then store and query entries over a REST API. No migration per content type.

**Core model** (see `README.md` and `docs/data-model.png`):
`Organization` -- many-to-many with `User` via `OrganizationMembership` (`role_id` is a bare int; `OWNER_ROLE_ID = 1` is a placeholder, no Role table).
`Organization` 1-N `ContentType` 1-N `Field`. `ContentType` 1-N immutable `ContentTypeVersion` (JSON Schema generated from Fields). `Entry` holds JSONB `data`, pinned to a `ContentTypeVersion` and validated against that version's schema. `APIKey` belongs to an Organization.

**Stack:** Python 3.11, Django 5.2, DRF, PostgreSQL, `jsonschema` (Draft 2020-12 + FormatChecker), simplejwt (JWT in httpOnly cookies), gunicorn. Frontend: Vite, React 19, TypeScript, Tailwind, React Router. Tests: pytest + pytest-django.

**Repo layout:** `backend/` (Django: apps `accounts`, `content`; thin API layer under `backend/api/` with `accounts/`, `auth/`, `content/`, `delivery/`, `monitoring/`; `backend/content_engine/settings.py`), `frontend/`, `docker-compose.yml`, `docs/`, the markdown docs above.

**Key design rules already settled (don't relitigate):**
- Layering: view = HTTP orchestration and authorization; serializer = translation/validation and handoff; `content/services/` = real business logic (transactions, locking, validation). A service exists only when there is real logic (Decisions 60, 64, 70).
- Tenant context is in the URL (`/api/organizations/<id>/...`), and the view verifies membership. Wrong org returns 404, not 403.
- Entry validation uses the pinned version's schema snapshot, never live Fields (Decision 98).
- Single-origin deployment, because auth cookies are `SameSite=Lax` (Decision 108). CORS is dev-only.
- Cursor pagination on entries only, page size 50 (Decisions 73-78).
- API keys: org-wide, read-only, no draft/published filter, SHA-256 hash (not PBKDF2), `lat_` prefix, separate `/api/delivery/` namespace by slug, server-to-server only, own throttle scope (Decisions 116-122).

---

## 3. Current state

### Verify first (do this before relying on the sections below)

My shell (Bash) was unavailable for the whole session that wrote this file, so I could **not** run `git status`, `git log`, `pytest`, or list files. Everything below was learned by reading files. At the start of the new session, run:

```bash
git status && git log --oneline -15
cd backend && pytest        # last known good count: 70 passing before API-key work; now higher
ls backend/api/delivery frontend/src/pages
```

### Done (seen in the code this session)

- Auth: signup, login, refresh, logout, `me`; JWT in httpOnly cookies; throttling (`login`/`signup`/`refresh` scopes plus anon/user defaults).
- Orgs, content types, fields, versions, entries; schema generation; entry validation; cursor pagination.
- Frontend wired to the real API. Token refresh on 401 (refresh once, retry once) is **implemented** in `frontend/src/lib/api.ts`.
- `/admin/` removed. Env-var config via django-environ. Logging to stdout. Health endpoint `GET /api/monitoring/health/`.
- Docker: `backend/Dockerfile` (migrations run on container start, per commit `0d060e9`), `frontend/Dockerfile` (multi-stage Node build then nginx), `frontend/nginx.conf`, `docker-compose.yml` (db + backend + web on port 8080, `NUM_PROXIES` default 1). `backend/requirements.txt` is pinned.
- **API keys, backend:** `APIKey` model in `accounts` (`organization`, `name`, `hashed_key` unique, `created_at`, `revoked_at`); `hash_api_key()` (SHA-256) in `accounts/models.py`; management endpoints `GET/POST /api/organizations/<org>/api-keys/` and `DELETE .../api-keys/<id>/`; `APIKeyAuthentication` registered in `DEFAULT_AUTHENTICATION_CLASSES`; read-only `DeliveryEntryViewSet` at `GET /api/delivery/content-types/<slug>/entries/` and `.../<id>/`; `delivery` throttle scope `60/min`.
- **API keys, frontend:** `frontend/src/lib/api.ts` already imports `APIKey` and `APIKeyCreated` types, and `ApiDocs.tsx` mentions "Settings → API Keys". *(The Settings page itself was not opened.)*

### Differences from the plan docs (check these)

- `APIKey.md` describes a `prefix` column for display. The model in `accounts/models.py` has **no `prefix` field**, so the list view cannot show a recognizable key stub unless it was added another way.
- `APIKey.md` says delivery uses `ScopedRateThrottle` keyed by key id/prefix. The code uses a custom `APIKeyRateThrottle` and `throttle_classes = [AnonRateThrottle, APIKeyRateThrottle]`.
- `ApiDocs.tsx` still says the delivery API is "coming soon" although the backend endpoints exist. That text needs updating and a delivery curl example added.
- `README.md` API overview table does not list the `api-keys` or `delivery` endpoints yet.
- Decisions.md "Phase API Keys" has entries 116-122 but, from what I read, no entry covers the throttle class choice or the missing `prefix`.

### Open items

- **Delivery tests:** unknown whether tests exist for `APIKeyAuthentication`, revoked keys, cross-org isolation (key for org A must not read org B's content type with the same slug), and throttling. Plan was about 15 tests. *(unverified)*
- **Docs to finish:** API-Contract.md section for api-keys and delivery; Surprise 1 in API-Contract.md was updated in `d7c3f82`; gap.md entry for "no draft/published, every entry readable with a key" (promised in Decision 117).
- **`gap.md` is gitignored,** so gap notes never reach the repo. Decide: un-ignore it or move the notes.
- **Production `SECRET_KEY`:** the old key is still in git history and signed real dev JWTs. Rotate it for deployment and decide whether history needs scrubbing (Decision 114's open item).
- **`NUM_PROXIES`** must be re-measured for whatever proxy chain is used (nginx = 1; Azure ingress + nginx = 2).
- **Hosting:** learning order is Docker, then Azure (30-day trial, no credit card; the subscription "Azure subscription 1" is the free-account one), then CI/CD, then a permanent host. Permanent host is **undecided**; no card, so candidates are Render + Neon + a keep-awake ping, or Vercel serverless (frontend on Vercel with an `/api` rewrite keeps single-origin). Decisions 108-114 describe the Azure target: one Container App with nginx in front of gunicorn, Postgres Flexible Server, secrets via Container Apps secrets, nginx must forward (not overwrite) `X-Forwarded-Proto`.
- **Deferred to V2 (in `gap.md`):** #1 no server-side token revocation; #2 entry validation only in the serializer, not at model level; #3 throttle counters are per worker (LocMemCache), fix with Redis or nginx `limit_req`.
- **Not finalized (Decisions.md):** Role/RBAC, Entry-to-Entry relations, field reuse, draft/published, content lifecycle, indexing strategy.
- **After deployment:** the TypeScript walkthrough (section 1).

### Suggested next step

Run the "Verify first" commands, then ask Arijit which they want: finish and test the API-key feature (and fix the doc/UI gaps above), or move on to deployment. Follow the protocol: propose, let Arijit choose, and ask who writes the code (Arijit writes and Claude reviews, Claude writes, or split) because this has been an open question for the API-key work.

---

## 4. Running things

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt      # includes requirements.txt
cp .env.example .env                     # edit values
python manage.py migrate && python manage.py runserver   # :8000
pytest

# Frontend
cd frontend && npm install && cp .env.example .env && npm run dev   # :3000
npm run lint                             # type-check

# Docker (needs POSTGRES_USER, POSTGRES_PASSWORD, SECRET_KEY in a root .env)
docker compose up --build                # app at http://localhost:8080
```

Env vars: `SECRET_KEY` (no default, crashes if missing), `DEBUG` (defaults False), `ALLOWED_HOSTS`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `NUM_PROXIES`. Frontend: `VITE_API_BASE_URL` (`http://localhost:8000/api` in dev, `/api` in production, baked in at build time).

Tests run against a throwaway Postgres database that Django creates and drops.

---

## 5. If the project is renamed

1. **Claude's auto-memory is stored per folder path** under `~/.claude/projects/<path-with-slashes-as-dashes>/memory/`. Renaming or moving `/Users/arijitdas/Lattice` makes the next session start with **no memory**. Copy the old `memory/` directory into the new path's `memory/` folder, or just tell the new session to read this file first.
2. Memory notes dated 2026-09-26 (API-key plan, pre-deploy list) are partly stale; this file supersedes them. Two memory index lines point at notes that were never saved as files (`feedback-syntax-vs-design`, `feedback-simple-python-django`). Their content is captured in section 1 above.
3. Search and replace the name in `README.md`, `API-Contract.md`, `frontend/index.html` and the page title, `backend/.env.example`, `docker-compose.yml` (database name is `content_engine`, unaffected), and the API-key prefix `lat_` (which stands for Lattice). **Changing the key prefix would invalidate any existing keys' recognizability but not their hashes.** Decide deliberately, and log it in `Decisions.md`.
4. The Django project package is `content_engine` and the DB is `content_engine`; neither carries the name Lattice, so they need no change.
5. Git remote and any Azure resource names are separate and not covered here.

## 6. Quick-start prompt for the new session

> Read `knowledge_transfer.md` in the repo root, then `Decisions.md` (at least Decisions 58, 60, 64, 98, 108, 116-122), `gap.md` and `Progress-Audit.md`. Follow the working protocol in section 1: propose, critique, implement, review; Socratic on design, direct on syntax; explain TypeScript simply. Run the "Verify first" commands before assuming the state described, then ask me what I want to do next.
