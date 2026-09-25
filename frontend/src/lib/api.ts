import type {
  ContentType,
  ContentTypeVersion,
  Entry,
  EntryPage,
  Field,
  FieldDataType,
  Organization,
} from '@/types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

// credentials: 'include' on every call - the access/refresh tokens live in
// httpOnly cookies, never in JS-readable state, so the browser has to be
// told to send them itself on cross-origin requests.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// The API answers errors in several shapes (API-Contract.md section 3):
// {"detail": "..."}, {"field": ["..."]}, {"data": {"field": ["..."]}} and a
// bare ["..."] array. This flattens any of them into a list of messages.
function collectMessages(body: unknown): string[] {
  if (typeof body === 'string') return [body];
  if (Array.isArray(body)) return body.flatMap(collectMessages);
  if (body && typeof body === 'object') {
    return Object.values(body).flatMap(collectMessages);
  }
  return [];
}

// One readable sentence for "something went wrong", whatever the error was.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages = collectMessages(error.body);
    return messages.length > 0 ? messages.join(' ') : `Request failed (${error.status}).`;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

// Entry validation errors arrive as {"data": {"price": ["Must be a number."]}}.
// Returns {price: ["Must be a number."]} so a form can put each message under
// its own input; empty when the error has no per-field part.
export function fieldErrors(error: unknown, key = 'data'): Record<string, string[]> {
  if (!(error instanceof ApiError)) return {};
  const body = error.body as Record<string, unknown> | null;
  const nested = body?.[key];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, string[]>;
  }
  return {};
}

// `next` is an absolute URL built from the request host, which can be wrong
// behind a proxy (API-Contract.md surprise 10). Only the cursor is needed, so
// take just that and always call our own base URL.
export function cursorFrom(next: string | null): string | null {
  if (!next) return null;
  return new URL(next).searchParams.get('cursor');
}

export type User = {
  id: number;
  email: string;
  name: string;
};

export const auth = {
  signup: (data: { name: string; email: string; password: string }) =>
    request<User>('/auth/signup/', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<Record<string, never>>('/auth/login/', { method: 'POST', body: JSON.stringify(data) }),

  logout: () => request<void>('/auth/logout/', { method: 'POST' }),

  me: () => request<User>('/auth/me/'),
};

export const organizations = {
  list: () => request<Organization[]>('/organizations/'),

  get: (orgId: number) => request<Organization>(`/organizations/${orgId}/`),

  create: (name: string) =>
    request<Organization>('/organizations/', { method: 'POST', body: JSON.stringify({ name }) }),
};

// Everything below lives under /organizations/{org}/..., so each call takes
// the organization id first.
const inOrg = (orgId: number) => `/organizations/${orgId}`;
const inContentType = (orgId: number, ctId: number) => `${inOrg(orgId)}/content-types/${ctId}`;

export const contentTypes = {
  list: (orgId: number) => request<ContentType[]>(`${inOrg(orgId)}/content-types/`),

  create: (orgId: number, data: { name: string; slug: string }) =>
    request<ContentType>(`${inOrg(orgId)}/content-types/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const fields = {
  list: (orgId: number, ctId: number) =>
    request<Field[]>(`${inContentType(orgId, ctId)}/fields/`),

  create: (
    orgId: number,
    ctId: number,
    data: { name: string; data_type: FieldDataType; required: boolean },
  ) =>
    request<Field>(`${inContentType(orgId, ctId)}/fields/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const versions = {
  // Newest first.
  list: (orgId: number, ctId: number) =>
    request<ContentTypeVersion[]>(`${inContentType(orgId, ctId)}/versions/`),

  // The server builds the schema from the content type's current Fields, so
  // the body is empty.
  create: (orgId: number, ctId: number) =>
    request<ContentTypeVersion>(`${inContentType(orgId, ctId)}/versions/`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export const entries = {
  list: (orgId: number, ctId: number, cursor?: string | null) =>
    request<EntryPage>(
      `${inContentType(orgId, ctId)}/entries/${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),

  get: (orgId: number, ctId: number, entryId: number) =>
    request<Entry>(`${inContentType(orgId, ctId)}/entries/${entryId}/`),

  create: (orgId: number, ctId: number, data: Record<string, unknown>) =>
    request<Entry>(`${inContentType(orgId, ctId)}/entries/`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
};
