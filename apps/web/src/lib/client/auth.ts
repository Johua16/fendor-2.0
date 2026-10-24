export type CurrentUser = { id: string; email: string; fullName: string; verified: boolean; roles: string[] };
type ErrorEnvelope = { error?: { code?: string; message?: string } };
export class AuthApiError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; } }
async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json().catch(() => ({})) as T & ErrorEnvelope;
  if (!response.ok) throw new AuthApiError(response.status, value.error?.code ?? 'REQUEST_FAILED', value.error?.message ?? 'Fendor could not complete this request.');
  return value;
}
export const signUp = (fullName: string, email: string, password: string) => request<{ message: string }>('/api/auth/signup', { fullName, email, password });
export const signIn = (email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/login', { email, password });
export const currentUser = () => request<{ user: CurrentUser }>('/api/auth/me');
export const signOut = () => request<{ message: string }>('/api/auth/logout', {});
export const resendVerification = (email: string) => request<{ message: string }>('/api/auth/resend-verification', { email });
export const forgotPassword = (email: string) => request<{ message: string }>('/api/auth/forgot-password', { email });
export const verifyEmail = (token: string) => request<{ message: string }>('/api/auth/verify-email', { token });
export const resetPassword = (token: string, password: string) => request<{ message: string }>('/api/auth/reset-password', { token, password });
export function safeNext(value: string | null, fallback = '/account') { return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback; }
