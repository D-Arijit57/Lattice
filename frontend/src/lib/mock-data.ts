import { Workspace, ContentType, SchemaField, SchemaVersion, Entry, ActivityLog } from '../types';

export const mockWorkspace: Workspace = {
  id: 'ws_01',
  name: 'Acme Inc.',
  members: 2,
  plan: 'Free Plan',
};

export const mockContentTypes: ContentType[] = [
  {
    id: 'ct_products',
    name: 'Products',
    slug: 'products',
    description: 'Product catalog and inventory data for our store.',
    entriesCount: 248,
    currentVersion: 'v3',
    versionStatus: 'Current',
    updatedAt: '2 hours ago',
  },
  {
    id: 'ct_categories',
    name: 'Categories',
    slug: 'categories',
    description: 'Product categories and taxonomy',
    entriesCount: 52,
    currentVersion: 'v2',
    versionStatus: 'Current',
    updatedAt: '5 hours ago',
  },
  {
    id: 'ct_orders',
    name: 'Orders',
    slug: 'orders',
    description: 'Customer orders and transactions',
    entriesCount: 1200,
    currentVersion: 'v4',
    versionStatus: 'Current',
    updatedAt: '1 day ago',
  },
  {
    id: 'ct_customers',
    name: 'Customers',
    slug: 'customers',
    description: 'Customer information and profiles',
    entriesCount: 856,
    currentVersion: 'v2',
    versionStatus: 'Current',
    updatedAt: '1 day ago',
  },
  {
    id: 'ct_posts',
    name: 'Blog Posts',
    slug: 'blog-posts',
    description: 'Content and marketing data',
    entriesCount: 34,
    currentVersion: 'v1',
    versionStatus: 'Archived',
    updatedAt: '3 days ago',
  },
  {
    id: 'ct_locations',
    name: 'Locations',
    slug: 'locations',
    description: 'Store and warehouse information',
    entriesCount: 12,
    currentVersion: 'v1',
    versionStatus: 'Current',
    updatedAt: '3 days ago',
  },
];

export const mockActivities: ActivityLog[] = [
  {
    id: 'act_1',
    action: 'New entry in Products',
    description: '2 minutes ago',
    timestamp: '2 minutes ago',
    icon: 'entry-created',
  },
  {
    id: 'act_2',
    action: 'Schema version v3 published',
    description: '12 minutes ago',
    timestamp: '12 minutes ago',
    icon: 'schema-published',
  },
  {
    id: 'act_3',
    action: 'Entry updated in Customers',
    description: '1 hour ago',
    timestamp: '1 hour ago',
    icon: 'entry-updated',
  },
  {
    id: 'act_4',
    action: 'API key regenerated',
    description: '5 hours ago',
    timestamp: '5 hours ago',
    icon: 'api-key-regenerated',
  },
  {
    id: 'act_5',
    action: 'Content type Categories created',
    description: '1 day ago',
    timestamp: '1 day ago',
    icon: 'content-type-created',
  },
];

export const mockSchemaFields: SchemaField[] = [
  {
    id: 'f_name',
    name: 'name',
    type: 'String',
    required: true,
    unique: false,
  },
  {
    id: 'f_price',
    name: 'price',
    type: 'Number',
    required: true,
    unique: false,
    description: 'Price of the product in INR.',
    validations: {
      min: 0,
      integer: true,
    },
  },
  {
    id: 'f_category',
    name: 'category',
    type: 'Enum',
    required: true,
    unique: false,
    validations: {
      options: ['Electronics', 'Accessories', 'Furniture']
    }
  },
  {
    id: 'f_published',
    name: 'published',
    type: 'Boolean',
    required: false,
    unique: false,
  },
  {
    id: 'f_metadata',
    name: 'metadata',
    type: 'Object',
    required: false,
    unique: false,
  },
  {
    id: 'f_tags',
    name: 'tags',
    type: 'Array',
    required: false,
    unique: false,
  }
];

export const mockSchemaVersions: SchemaVersion[] = [
  {
    id: 'v3',
    version: 'v3',
    status: 'Current',
    createdAt: 'Sep 3, 2026',
    createdBy: 'Arijit Das',
    fieldsCount: 12,
    summary: 'Added metadata field and updated validation',
    changes: [
      'Added metadata field',
      'Updated price validation',
      'Set category as required',
    ],
  },
  {
    id: 'v2',
    version: 'v2',
    status: 'Archived',
    createdAt: 'Aug 12, 2026',
    createdBy: 'Sarah Chen',
    fieldsCount: 10,
    summary: 'Added category field',
    changes: [
      'Added category field',
    ],
  },
  {
    id: 'v1',
    version: 'v1',
    status: 'Archived',
    createdAt: 'Jan 15, 2026',
    createdBy: 'Arijit Das',
    fieldsCount: 8,
    summary: 'Initial version',
    changes: [
      'Created initial schema',
    ],
  },
];

export const mockEntries: Entry[] = [
  {
    id: 'prod_01H6F7',
    contentTypeId: 'ct_products',
    version: 'v3',
    status: 'Published',
    updatedAt: '2 minutes ago',
    data: {
      name: 'MacBook Pro',
      category: 'Electronics',
      price: 120000,
      published: true,
      tags: ['laptop', 'apple'],
      metadata: { brand: 'Apple', warranty: '1 year' }
    }
  },
  {
    id: 'prod_01H6F6',
    contentTypeId: 'ct_products',
    version: 'v3',
    status: 'Draft',
    updatedAt: '10 minutes ago',
    data: {
      name: 'Mechanical Keyboard',
      category: 'Electronics',
      price: 8000,
    }
  },
  {
    id: 'prod_01H6F5',
    contentTypeId: 'ct_products',
    version: 'v3',
    status: 'Published',
    updatedAt: '1 hour ago',
    data: {
      name: '4K Monitor',
      category: 'Electronics',
      price: 25000,
    }
  },
  {
    id: 'prod_01H6F4',
    contentTypeId: 'ct_products',
    version: 'v3',
    status: 'Published',
    updatedAt: '3 hours ago',
    data: {
      name: 'Wireless Mouse',
      category: 'Accessories',
      price: 5000,
    }
  },
  {
    id: 'prod_01H6F3',
    contentTypeId: 'ct_products',
    version: 'v3',
    status: 'Draft',
    updatedAt: '5 hours ago',
    data: {
      name: 'USB-C Hub',
      category: 'Accessories',
      price: 7500,
    }
  },
];
