// Shapes of the objects the Lattice API returns (see API-Contract.md).
// Field names are snake_case on purpose: they are exactly what comes over
// the wire, so no mapping layer sits between the API and the UI.

export type Organization = {
  id: number;
  name: string;
  // The signed-in user's role in this organization, as the number the backend
  // stores (0 viewer ... 3 owner). Compare it with ROLE in lib/roles.ts.
  my_role: number;
  created_at: string;
  updated_at: string;
};

export type ContentType = {
  id: number;
  name: string;
  slug: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
};

// The data types the backend supports (content/services/schema_generation.py).
export type FieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime';

export type Field = {
  id: number;
  content_type_id: number;
  name: string;
  data_type: FieldDataType;
  required: boolean;
};

// One property inside a version's JSON Schema, as generate_schema() writes it.
export type SchemaProperty = {
  type: 'string' | 'number' | 'boolean';
  // 'date' is a calendar day, 'date-time' a moment in time (a "datetime" field).
  format?: 'date' | 'date-time';
};

export type VersionSchema = {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
  additionalProperties: boolean;
};

export type ContentTypeVersion = {
  id: number;
  content_type_id: number;
  version_number: number;
  schema: VersionSchema;
  created_at: string;
};

export type Entry = {
  id: number;
  // Per-content-type sequence (1, 2, 3...). `id` is the global database id:
  // use it for URLs and keys, and `number` for anything the user reads.
  number: number;
  content_type_version_id: number;
  version_number: number;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // null = live; a timestamp = archived (soft-deleted, restorable).
  archived_at: string | null;
};

// Entries are cursor-paginated: `next` is an absolute URL ending in ?cursor=...
export type EntryPage = {
  next: string | null;
  previous: string | null;
  results: Entry[];
};

// POST .../entries/bulk/ is all-or-nothing: a success saves every row, a 400
// saves none and lists the bad rows. `row` is the 0-based index into the
// array that was sent.
export type BulkCreateResult = {
  created: number;
  entries: Entry[];
};

export type BulkEntryError = {
  row: number;
  data: Record<string, string[]>;
};

// What GET/POST/DELETE /organizations/{org}/api-keys/ return. The backend
// serializer only exposes these four fields - hashed_key never leaves the
// server, so it has no business in this type either.
export type APIKey = {
  id: number;
  name: string;
  created_at: string;
  revoked_at: string | null;
};

// Only the create response includes this - the raw secret is generated once,
// shown once, and never stored or returned again after this.
export type APIKeyCreated = APIKey & {
  key: string;
};

// One row of GET /organizations/{org}/members/. `id` is the membership id (use
// it in URLs); `user_id` is the person.
export type Member = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role_id: number;
  created_at: string;
};

// A registered user found by the invite search. Only these three fields are
// ever exposed.
export type UserSearchResult = {
  id: number;
  name: string;
  email: string;
};

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type Invitation = {
  id: number;
  organization: number;
  organization_name: string;
  invited_user: number;
  invited_user_name: string;
  invited_user_email: string;
  invited_by_name: string;
  role_id: number;
  status: InvitationStatus;
  created_at: string;
  responded_at: string | null;
};

// One field as the schema diff describes it. `type` is the JSON Schema type and
// `format` is "date" or "date-time" for those two field types, else null.
export type DiffedField = {
  name: string;
  type: string;
  format: string | null;
  required: boolean;
};

export type FieldShape = Omit<DiffedField, 'name'>;

// What a draft changes compared with the latest published version.
export type SchemaDiff = {
  added: DiffedField[];
  removed: DiffedField[];
  changed: { name: string; from: FieldShape; to: FieldShape }[];
};

export type PublishRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type PublishRequest = {
  id: number;
  content_type_id: number;
  note: string;
  status: PublishRequestStatus;
  requested_by: number | null;
  requested_by_name: string | null;
  decided_by: number | null;
  decided_by_name: string | null;
  decision_note: string;
  // the version an approved request produced
  version_number: number | null;
  // Only filled by GET .../publish-requests/{id}/ and only while pending; the
  // list never carries it.
  diff: SchemaDiff | null;
  created_at: string;
  decided_at: string | null;
};

export type NotificationKind =
  | 'invitation'
  | 'publish_requested'
  | 'publish_approved'
  | 'publish_rejected';

// `payload` holds the ids needed to link to what the notification is about.
// Which keys exist depends on `kind`, and all of them are optional here
// because an old notification may lack a newer key.
export type NotificationPayload = {
  organization_id?: number;
  invitation_id?: number;
  content_type_id?: number;
  content_type_slug?: string;
  publish_request_id?: number;
};

export type AppNotification = {
  id: number;
  kind: NotificationKind;
  message: string;
  payload: NotificationPayload;
  organization: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};
