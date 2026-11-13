# Lattice API Contract (V1)

Verified **live on 2026-09-20** against the running Django dev server (a scratch copy of the database, so no real data was touched). Every status code and body shape below was observed in a real response unless it is listed under "Not probed live".

> **Added 2026-11-14: roles, members, invitations, publish requests, notifications.** Those sections (marked *roles*) were not curl-probed like the rest. Their status codes and bodies come from the automated tests (`api/accounts/test_members.py`, `test_notifications.py`, `api/content/test_roles*.py`, `test_publish_requests.py`) and a manual run of every role in a browser. Treat them as verified by tests, not by a live probe.

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
| Methods that exist | `GET`, `POST`, `PATCH` (entries, member roles) and `DELETE` (archive/revoke/cancel/remove). `PUT` is not used anywhere and returns `405 {"detail": "Method \"PUT\" not allowed."}` |

## 2. Endpoints

`{org}` = organization id, `{ct}` = content type id. "Membership errors" means the two failures every `/organizations/{org}/...` route can return, listed once below the table.

### Auth

| Endpoint | Auth | Sends | Success | Failures |
|---|---|---|---|---|
| `POST /api/auth/signup/` | none (never authenticates, see Surprise 1) | `{name, email, password}` | `201 {id, name, email, created_at}` | `400` per-field errors: `email` duplicate `["user with this email already exists."]`, `password` list (min 8 chars, too common, all numeric), any missing field `["This field is required."]`. Malformed JSON: `400 {"detail": "JSON parse error - ..."}` |
| `POST /api/auth/login/` | none | `{email, password}` | `200 {}` plus **two `Set-Cookie`** headers. Tokens are never in the body. | `400` missing fields (per-field errors). `401 {"detail": "No active account found with the given credentials"}`, identical for wrong password and unknown email. |
| `POST /api/auth/refresh/` | `refresh_token` cookie | nothing | `200 {}` plus a new `access_token` cookie. The refresh token is **not** rotated. | `401 {"detail": "Refresh token cookie not found."}` if no cookie. `401 {"detail": "Token is invalid", "code": "token_not_valid"}` if bad or expired. |
| `POST /api/auth/logout/` | none required | nothing | `204`, no body, two `Set-Cookie` headers that expire both cookies | none; an expired or garbage `access_token` cookie is ignored and the cookies are still cleared (Surprise 1) |
| `GET /api/auth/me/` | `access_token` cookie | nothing | `200 {id, email, name}` | `401 {"detail": "Authentication credentials were not provided."}` with no cookie. `401 {"detail": "Given token not valid for any token type", "code": "token_not_valid", "messages": [{"token_class": "AccessToken", "token_type": "access", "message": "Token is expired"}]}` for a bad or expired cookie (`message` is `"Token is invalid"` for garbage) |

### Organizations

| Endpoint | Auth | Sends | Success | Failures |
|---|---|---|---|---|
| `GET /api/organizations/` | yes | nothing | `200` bare array of `{id, name, my_role, created_at, updated_at}`, only orgs you belong to, ordered by name. `my_role` is your role there (0 viewer, 1 editor, 2 admin, 3 owner). | `401 {"detail": "Authentication credentials were not provided."}` |
| `POST /api/organizations/` | yes | `{name}` (whitespace trimmed; client `id` ignored) | `201 {id, name, my_role, created_at, updated_at}`. Also makes you the org's first member, as **owner** (`role_id=3`; it was `1` before roles existed). | `400 {"name": ["This field may not be blank."]}`, `{"name": ["This field is required."]}` |
| `GET /api/organizations/{org}/` | yes | nothing | `200 {id, name, my_role, created_at, updated_at}` | `404 {"detail": "No Organization matches the given query."}` for a nonexistent org **and** an org you are not in |
| `DELETE /api/organizations/{org}/` | yes, **owner only** *(roles)* | nothing | `204`. Soft delete: the org disappears from every list, its data is kept. | `404` for a nonexistent or archived org and for a non-member. `403 {"detail": "Only an owner can delete the organization."}` for a member who is not the owner. |

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
| `POST entries/bulk/` | `{entries: [{...data}, {...data}]}`, 1 to 500 rows, each row is one entry's `data`. All rows attach to the **latest** version. | `201 {created, entries}`; `entries` is a list of the same shape as a single create, numbered consecutively in the order sent. **All-or-nothing.** | `400 {"errors": [{"row": 1, "data": {"price": ["Must be a number."]}}]}`: every bad row is listed, `row` is the **0-based** index into the array sent, and **nothing is saved**. A bad envelope (missing/empty/over 500/non-object rows) is `400 {"entries": ...}` instead. Membership errors, and `404` when the content type has no versions, as for `POST entries/`. |
| `GET entries/{id}/` | nothing | `200` same shape | `404 {"detail": "No Entry matches the given query."}` |

### Roles (*roles*)

Roles are numbers, and a higher number can do everything a lower one can: **0 viewer < 1 editor < 2 admin < 3 owner**. Each organization has exactly one owner. Every member's role is returned as `my_role` on the organization routes and as `role_id` on member rows.

What each role may do:

| Action | Minimum role |
|---|---|
| Read content types, fields, versions, entries | viewer (any member) |
| Create, edit, archive, restore entries; bulk create; archive all | editor |
| Add or archive **fields** (the draft schema) | editor |
| List and read publish requests, create one, withdraw your own | editor |
| Publish a version directly (`POST versions/`), approve or reject a publish request, withdraw anyone's request | admin |
| Create or archive content types | admin |
| List, create and revoke API keys | admin |
| List members, search users, send and cancel invitations, remove members (see below) | admin |
| Change a member's role, transfer ownership | owner |
| Delete the organization | owner |

Order of checks on every `/organizations/{org}/...` route: `401` (not logged in), `404` (org missing or archived), `403` (not a member), then **`403 {"detail": "Your role does not allow this action."}` (role too low), and only then body validation**. A viewer who sends an invalid body therefore gets `403`, never a `400` that would reveal the schema.

### Members (under `/api/organizations/{org}/`) (*roles*)

| Endpoint | Role | Sends | Success | Failures |
|---|---|---|---|---|
| `GET members/` | admin | nothing | `200` bare array of `{id, user_id, name, email, role_id, created_at}`, owner first, then by role (high to low) and name. `id` is the **membership** id used in the URLs below. | role `403` |
| `PATCH members/{id}/` | owner | `{role_id}` where `role_id` is `0`, `1` or `2` | `200` the member row | `400 {"detail": "The owner's role changes through an ownership transfer."}` when the target is the owner (this includes yourself). `400 {"role_id": ["\"3\" is not a valid choice."]}` for owner or unknown roles. `404` for a membership of another org. |
| `DELETE members/{id}/` | admin | nothing | `204`. The owner may remove anyone except the owner row. An admin may remove editors and viewers only. | `403 {"detail": "You cannot remove this member."}` (admin removing an admin or the owner, or the owner removing themself). `404` for another org's member. |
| `POST members/{id}/transfer-ownership/` | owner | nothing | `200` the new owner's row. The target becomes owner and you become **admin**, in one locked transaction. | `400 {"detail": "You are already the owner."}` |
| `GET user-search/?q=ada` | admin | query string `q` | `200` bare array of `{id, name, email}`, **at most 5**, active users who are not members, matched on name or email (case-insensitive substring), ordered by name | `400 {"q": ["Type at least 2 characters."]}` |

### Invitations (*roles*)

Only existing users can be invited. An invitation does nothing until the invitee accepts, and accepting is what creates the membership with the invited role. Status is `pending`, `accepted`, `declined` or `cancelled`; rows are kept as history.

Invitation shape: `{id, organization, organization_name, invited_user, invited_user_name, invited_user_email, invited_by_name, role_id, status, created_at, responded_at}`.

| Endpoint | Role | Sends | Success | Failures |
|---|---|---|---|---|
| `GET organizations/{org}/invitations/` | admin | nothing | `200` bare array of this org's **pending** invitations, newest first | role `403` |
| `POST organizations/{org}/invitations/` | admin | `{invited_user, role_id}` (`invited_user` is a user id; `role_id` is `0`, `1` or `2`) | `201` invitation | `400 {"invited_user": ["This user is already a member."]}`, `["This user already has a pending invitation."]`, `["This user cannot be invited."]` (inactive). `400 {"role_id": ["You cannot invite someone with this role."]}` (includes owner). |
| `DELETE organizations/{org}/invitations/{id}/` | admin | nothing | `204`. Status becomes `cancelled`. | `404` if not pending or not this org's |
| `GET invitations/` | login only | nothing | `200` bare array of **your** pending invitations (archived orgs excluded) | `401` |
| `POST invitations/{id}/accept/` | login only | nothing | `200` invitation (`accepted`). You are now a member with `role_id`. | `404` if it is not yours or no longer pending. `400 {"detail": "You are already a member."}` |
| `POST invitations/{id}/decline/` | login only | nothing | `200` invitation (`declined`) | `404` as above |

### Publish requests (under `.../content-types/{ct}/publish-requests/`) (*roles*)

Editors change fields as a draft but cannot publish a version. They ask, and an admin or owner approves (which publishes the live fields as the next version) or rejects. Entries already in the database stay on the version they were saved under. One request can be pending per content type.

Shape: `{id, content_type_id, note, status, requested_by, requested_by_name, decided_by, decided_by_name, decision_note, version_number, diff, created_at, decided_at}`. `status` is `pending`, `approved`, `rejected` or `cancelled`. `version_number` is set once approved. `diff` is `null` except on `GET {id}/` and on the create response **while the request is pending**, and is computed from the live fields at the moment you ask: `{added: [{name, type, format, required}], removed: [...], changed: [{name, from: {type, format, required}, to: {...}}]}` (`format` is `"date"`, `"date-time"` or `null`).

| Endpoint | Role | Sends | Success | Failures |
|---|---|---|---|---|
| `GET publish-requests/` (`?status=pending`) | editor | nothing | `200` bare array, newest first, `diff` is `null` | role `403`, `404 "Content type not found."` |
| `POST publish-requests/` | editor | `{note}` (optional, max 500) | `201` request with `diff` | `400 {"detail": "Add at least one field before requesting a publish."}`, `{"detail": "Nothing to publish: the fields match the latest version."}`, `{"detail": "There is already a pending publish request for this content type."}` |
| `GET publish-requests/{id}/` | editor | nothing | `200` request (with `diff` if pending) | `404` |
| `DELETE publish-requests/{id}/` | editor, and it must be your own request unless you are admin | nothing | `204`. Status becomes `cancelled`. | `403 {"detail": "Only the requester or an admin can cancel this request."}`, `400 {"detail": "Only a pending request can be cancelled."}` |
| `POST publish-requests/{id}/approve/` | admin | `{decision_note}` (optional) | `200` request (`approved`, `version_number` set). Creates the version. | `400 {"detail": "This request has already been decided."}`, `{"detail": "Nothing to publish: the fields match the latest version."}` (the draft was reverted since the request) |
| `POST publish-requests/{id}/reject/` | admin | `{decision_note}` (**required**) | `200` request (`rejected`) | `400 {"decision_note": ["This field is required."]}` (or `may not be blank`), `400 {"detail": "This request has already been decided."}` |

### Notifications (*roles*)

In-app only; there is no email. A notification is written in the same transaction as the action it reports, so a failed action notifies nobody.

| Event | Recipients | `kind` | `payload` keys |
|---|---|---|---|
| Invitation sent | the invitee | `invitation` | `invitation_id`, `organization_id` |
| Publish requested | every admin and the owner, except the requester | `publish_requested` | `organization_id`, `content_type_id`, `content_type_slug`, `publish_request_id` |
| Publish approved | the requester (not if they approved it themself) | `publish_approved` | same as above |
| Publish rejected | the requester (not if they rejected it themself) | `publish_rejected` | same as above |

Answering or cancelling an invitation marks its notification read. `message` is plain text written when the event happened and does not change if names change later.

| Endpoint | Sends | Success | Failures |
|---|---|---|---|
| `GET notifications/` (`?unread=true`) | nothing | `200` bare array, newest first, **at most 50**, each `{id, kind, message, payload, organization, is_read, read_at, created_at}` | `401` |
| `GET notifications/unread-count/` | nothing | `200 {"unread": 3}` | `401` |
| `POST notifications/{id}/read/` | nothing | `200` notification. Idempotent: reading twice keeps the first `read_at`. | `404` for someone else's notification |
| `POST notifications/read-all/` | nothing | `200 {"marked": 2}`, your own only | `401` |

### Failures common to every `/organizations/{org}/...` route

| Status | Body | When |
|---|---|---|
| `401` | `{"detail": "Authentication credentials were not provided."}` | no cookie (bad or expired cookie: the `token_not_valid` shape above) |
| `404` | `{"detail": "Organization not found."}` | org id does not exist |
| `403` | `{"detail": "You are not a member of this organization."}` | org exists, you are not in it |
| `403` | `{"detail": "Your role does not allow this action."}` | you are a member but your role is below what the route needs (see Roles above). Checked **before** the body is validated. |

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

1. **(Fixed) An expired access cookie used to block logout and signup.** `SignupView` and `LogoutView` now set `authentication_classes = []`, so a stale cookie is ignored and both always work. Kept here because older clients may still work around it by refreshing first.
2. **Org existence leaks, and 403/404 are inconsistent.** `GET /organizations/{id}/` returns `404` for an org you're not in, but `GET /organizations/{id}/content-types/` returns `403 "You are not a member"`, so any logged-in user can tell which org ids exist. Decision 106 says other orgs' rows should look like they don't exist; the membership check in `get_organization()` doesn't follow that.
3. **(Superseded) Nothing can be edited or deleted.** True on 2026-09-20. Entries can now be edited (`PATCH`) and archived, and fields, content types and organizations can be archived (all soft deletes, with role requirements below).
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
