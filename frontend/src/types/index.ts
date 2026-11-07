// Shapes of the objects the Lattice API returns (see API-Contract.md).
// Field names are snake_case on purpose: they are exactly what comes over
// the wire, so no mapping layer sits between the API and the UI.

export type Organization = {
  id: number;
  name: string;
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
