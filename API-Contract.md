# Loom API Contract (V1)

Verified **live on 2026-09-20** against the running Django dev server (a scratch copy of the database, so no real data was touched). Every status code and body shape below was observed in a real response unless it is listed under "Not probed live".

## 1. Conventions

| | |
|---|---|
| Base path | `/api/` (e.g. `POST /api/auth/login/`) |
| Format | JSON in, JSON out. Send `Content-Type: application/json`. |
| IDs | Integers. Timestamps are ISO-8601 UTC ending in `Z`. |
| Auth | Two httpOnly cookies set by login. The client never sees the tokens; the browser must be told to send cookies (`credentials: 'include'` / `withCredentials`). |
| `access_token` cookie | `Path=/`, `Max-Age=900` (15 min), `HttpOnly`, `SameSite=Lax` |
| `refresh_token` cookie | `Path=/api/auth/refresh/` (only sent to that URL), `Max-Age=604800` (7 days), `HttpOnly`, `SameSite=Lax` |
| `Secure` flag | Not set in dev (`DEBUG=True`); set when `DEBUG=False` |
| Lists | Bare JSON arrays, **except** entries, which are `{next, previous, results}` |
| Methods that exist | Only `GET` and `POST`. Everything else returns `405 {"detail": "Method \"PUT\" not allowed."}` |

## 2. Endpoints

`{org}` = organization id, `{ct}` = content type id. "Membership errors" means the two failures every `/organizations/{org}/...` route can return, listed once below the table.

### Auth

| Endpoint | Auth | Sends | Success | Failures |
|---|---|---|---|---|
| `POST /api/auth/signup/` | none (but see Surprise 1) | `{name, email, password}` | `201 {id, name, email, created_at}` | `400` per-field errors: `email` duplicate `["user with this email already exists."]`, `password` list (min 8 chars, too common, all numeric), any missing field `["This field is required."]`. Malformed JSON: `400 {"detail": "JSON parse error - ..."}` |
| `POST /api/auth/login/` | none | `{email, password}` | `200 {}` plus **two `Set-Cookie`** headers. Tokens are never in the body. | `400` missing fields (per-field errors). `401 {"detail": "No active account found with the given credentials"}`, identical for wrong password and unknown email. |
| `POST /api/auth/refresh/` | `refresh_token` cookie | nothing | `200 {}` plus a new `access_token` cookie. The refresh token is **not** rotated. | `401 {"detail": "Refresh token cookie not found."}` if no cookie. `401 {"detail": "Token is invalid", "code": "token_not_valid"}` if bad or expired. |
| `POST /api/auth/logout/` | none required | nothing | `204`, no body, two `Set-Cookie` headers that expire both cookies | `401` token_not_valid if the request carries an expired or garbage `access_token` cookie, and then **the cookies are not cleared** (Surprise 1) |
| `GET /api/auth/me/` | `access_token` cookie | nothing | `200 {id, email, name}` | `401 {"detail": "Authentication credentials were not provided."}` with no cookie. `401 {"detail": "Given token not valid for any token type", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "Token is expired"}]}` for a bad or expired cookie (`message` is `"Token is invalid"` for garbage) |

### Organizations

| Endpoint | Auth | Sends | Success | Failures |
|---|---|---|---|---|
| `GET /api/organizations/` | yes | nothing | `200` bare array of `{id, name, created_at, updated_at}`, only orgs you belong to, ordered by name | `401 {"detail": "Authentication credentials were not provided."}` |
| `POST /api/organizations/` | yes | `{name}` (whitespace trimmed; client `id` ignored) | `201 {id, name, created_at, updated_at}`. Also makes you the org's first member (`role_id=1`). | `400 {"name": ["This field may not be blank."]}`, `{"name": ["This field is required."]}` |
| `GET /api/organizations/{org}/` | yes | nothing | `200 {id, name, created_at, updated_at}` | `404 {"detail": "No Organization matches the given query."}` for a nonexistent org **and** an org you are not in |

### Content types (all under `/api/organizations/{org}/`)

| Endpoint | Sends | Success | Failures |
|---|---|---|---|
| `GET content-types/` | nothing | `200` bare array of `{id, name, slug, organization_id, created_at, updated_at}`, ordered by name | membership errors |
| `POST content-types/` | `{name, slug}`. Slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`. A client `organization` is ignored. | `201` same shape as above | `400 {"slug": ["Enter a valid slug"]}`, `{"non_field_errors": ["The fields organization, slug must make a unique set."]}`, missing `name`/`slug` per-field |
| `GET content-types/{ct}/` | nothing | `200` same shape | `404 {"detail": "No ContentType matches the given query."}` |

### Fields (under `.../content-types/{ct}/fields/`)

| Endpoint | Sends | Success | Failures |
|---|---|---|---|
| `GET fields/` | nothing | `200` bare array of `{id, content_type_id, name, data_type, required}`, ordered by name | membership errors; `404 {"detail": "Content type not found."}` |
| `POST fields/` | `{name, data_type, required}`. `data_type` is one of `string`, `number`, `boolean`, `date`. **`required` defaults to `true` if omitted.** | `201` same shape | `400 {"data_type": ["data_type must be one of: boolean, date, number, string."]}`, `{"non_field_errors": ["The fields content_type, name must make a unique set."]}`, `{"required": ["Must be a valid boolean."]}`, missing `name`/`data_type` per-field |
| `GET fields/{id}/` | nothing | `200` same shape | see "Not probed live" |

### Versions (under `.../content-types/{ct}/versions/`)

| Endpoint | Sends | Success | Failures |
|---|---|---|---|
| `GET versions/` | nothing | `200` bare array, **newest first**, of `{id, content_type_id, version_number, schema, created_at}` | membership errors; `404 {"detail": "Content type not found."}` |
| `POST versions/` | `{}` (nothing needed; a client `schema` is ignored) | `201` same shape. `schema` is generated from the content type's current fields; `version_number` increments (1, 2, 3...). | `400 ["Cannot create a version: this ContentType has no Fields defined."]`, **a bare JSON array, not an object** (Surprise 4) |
| `GET versions/{id}/` | nothing | `200` same shape | `404 {"detail": "No ContentTypeVersion matches the given query."}` |

### Entries (under `.../content-types/{ct}/entries/`)

| Endpoint | Sends | Success | Failures |
|---|---|---|---|
| `GET entries/` | nothing | `200 {next, previous, results}`. 50 per page, newest first, across all versions. Each result is `{id, content_type_version_id, version_number, data, created_at, updated_at}`. `next` is an **absolute URL** ending in `?cursor=...`, or `null` on the last page. `?page_size=` is ignored. | `404 {"detail": "Invalid cursor"}` for a garbage cursor; membership errors |
| `POST entries/` | `{data: {...}}`. Attached to the content type's **latest** version; a client `content_type_version` is ignored. | `201` same shape as a result above | `400 {"data": {"<field>": ["msg"]}}`, all errors reported at once, messages: `"This field is required."`, `"Must be a number."`, `"Unknown field."`, `"Must be a valid date (YYYY-MM-DD)."`. Data not an object: `{"data": {"non_field_errors": ["Must be a JSON object."]}}`. `data` null: `{"data": ["This field may not be null."]}`. `data` missing: `{"data": ["This field is required."]}`. No version exists yet: **`404`** `{"detail": "This content type has no versions yet."}` |
| `GET entries/{id}/` | nothing | `200` same shape | `404 {"detail": "No Entry matches the given query."}` |

### Failures common to every `/organizations/{org}/...` route

| Status | Body | When |
|---|---|---|
| `401` | `{"detail": "Authentication credentials were not provided."}` | no cookie (bad or expired cookie: the `token_not_valid` shape above) |
| `404` | `{"detail": "Organization not found."}` | org id does not exist |
| `403` | `{"detail": "You are not a member of this organization."}` | org exists, you are not in it |

## 3. Error shapes the client must handle

The API produces **six distinct error bodies**, not one. A client cannot assume a single shape.

1. **Per-field errors**: `{"<field>": ["msg", ...]}` (400). Signup, login, org, content type, field.
2. **Object-level errors**: `{"non_field_errors": ["msg"]}` (400). Unique-together failures.
3. **Detail only**: `{"detail": "msg"}` (400 JSON parse, 401 login/refresh, 403, 404, 405).
4. **Token failure**: `{"detail", "code": "token_not_valid", "messages": [...]}` (401). The only place "expired" vs "garbage" can be told apart is `messages[0].message`.
5. **Nested entry errors**: `{"data": {"<field>": ["msg"], "non_field_errors": [...]}}` or `{"data": ["msg"]}` (400).
6. **Bare array**: `["msg"]` (400, version creation only).

Plus one that is **not JSON**: any unknown URL or non-integer id (`/api/nope/`, `/api/organizations/abc/`) returns an **HTML** 404 page.

## 4. CORS

- Allowed origins: `http://localhost:3000` and `http://localhost:3001`.
- Preflight from an allowed origin returns `access-control-allow-origin: <that origin>`, `access-control-allow-credentials: true`, allowed headers (`accept, authorization, content-type, user-agent, x-csrftoken, x-requested-with`), `access-control-max-age: 86400`.
- Preflight from a disallowed origin gets `200` with **no** `access-control-*` headers, so the browser blocks the call.
- Normal responses to an allowed origin also carry the two `access-control-*` headers.

## 5. Surprises (where live behavior differs from what the code suggests)

1. **An expired access cookie blocks logout and signup.** DRF authenticates every request that touches `request.user`, and `LogoutView` and `SignupView` don't switch authentication off (login and refresh do, via simplejwt's `authentication_classes = ()`). So a user whose 15-minute token expired gets `401` on logout and the cookies stay. *Client consequence:* refresh first, or treat logout as best-effort. *Backend option (your call):* set `authentication_classes = []` on those two views.
2. **Org existence leaks, and 403/404 are inconsistent.** `GET /organizations/{id}/` returns `404` for an org you're not in, but `GET /organizations/{id}/content-types/` returns `403 "You are not a member"`, so any logged-in user can tell which org ids exist. Decision 106 says other orgs' rows should look like they don't exist; the membership check in `get_organization()` doesn't follow that.
3. **Nothing can be edited or deleted.** No `PUT`/`PATCH`/`DELETE` on any resource. A UI "edit entry", "edit field" or "delete content type" has no endpoint to call.
4. **Version creation with no fields returns a bare JSON array**, unlike every other 400. The `create()` path raises the error outside normal validation, so DRF doesn't wrap it in an object.
5. **Unknown URLs return an HTML 404**, so a client that always calls `response.json()` will throw on those.
6. **Signup accepts any string as an email** (`"not-an-email"` returned `201`).
7. **The duplicate-email message comes from Django's automatic unique check** (`"user with this email already exists."`), not from the custom `validate_email` (`"A user with this email already exists."`). The serializer's own check never gets to speak.
8. **`required` defaults to `true`.** A field created without it is required, and forgetting it made my first test entries fail.
9. **A missing version is a `404`, not a `400`**, when creating an entry, so a client must not read every 404 as "wrong URL".
10. **`next` is an absolute URL built from the request's host.** Behind a reverse proxy it can point at the wrong scheme or host unless the proxy headers are configured.
11. **Good, and confirmed:** wrong password and unknown email give the *same* 401 (no user enumeration on login); client-supplied `organization`, `schema`, `content_type_version` and `id` are all ignored; a spoofed entry version was stored under the latest version; `page_size` cannot be overridden.

## 6. Not probed live

- `GET fields/{id}/` for a nonexistent id (expected standard DRF `404 "No Field matches the given query."`).
- A content type id belonging to *another* org, requested under my org (the code filters by organization, so it should be the same 404 as a nonexistent id).
- Non-member `POST` to fields, versions and entries (only content types, fields-list and entries-list were tried; all share one base class).
- The `Secure` cookie flag with `DEBUG=False`, any `500` path, and concurrent version creation.

## 7. How this was produced (repeat this on the next project)

1. Read `urls.py`, views and serializers to form a hypothesis for each endpoint.
2. Create a **scratch database**, run migrations, and start the server against it, so probing never touches real data.
3. Script every call, including failures (no cookie, expired cookie, wrong user, bad body, unknown id) and record status, headers and body.
4. Compare the responses to the hypothesis. Every difference goes in the Surprises list.
5. Drop the scratch database.
