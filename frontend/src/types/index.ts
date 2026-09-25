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

// The four data types the backend supports (content/services/schema_generation.py).
export type FieldDataType = 'string' | 'number' | 'boolean' | 'date';

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
  format?: 'date';
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
  content_type_version_id: number;
  version_number: number;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// Entries are cursor-paginated: `next` is an absolute URL ending in ?cursor=...
export type EntryPage = {
  next: string | null;
  previous: string | null;
  results: Entry[];
};
