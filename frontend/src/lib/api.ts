import axios from 'axios'

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
