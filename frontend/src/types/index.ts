export type Workspace = {
  id: string;
  name: string;
  members: number;
  plan: string;
};

export type ContentType = {
  id: string;
  name: string;
  slug: string;
  description: string;
  entriesCount: number;
  currentVersion: string;
  versionStatus: 'Current' | 'Archived' | 'Draft';
  updatedAt: string;
};

export type SchemaField = {
  id: string;
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Enum' | 'Object' | 'Array' | 'Date' | 'Reference';
  required: boolean;
  unique: boolean;
  description?: string;
  validations?: {
    min?: number;
    max?: number;
    integer?: boolean;
    options?: string[];
  };
};

export type SchemaVersion = {
  id: string;
  version: string;
  status: 'Current' | 'Archived' | 'Draft';
  createdAt: string;
  createdBy: string;
  fieldsCount: number;
  summary: string;
  changes: string[];
};

export type Entry = {
  id: string;
  contentTypeId: string;
  version: string;
  status: 'Published' | 'Draft' | 'Archived';
  updatedAt: string;
  data: Record<string, any>;
};

export type ActivityLog = {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  icon: 'entry-created' | 'entry-updated' | 'schema-published' | 'api-key-regenerated' | 'content-type-created';
};
