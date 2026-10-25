export type AccountType='customer'|'vendor';
export type CurrentUser = { id: string; email: string; fullName: string; verified: boolean; roles: string[]; onboardingIntent:AccountType; dateOfBirth:string|null; phone:string|null };
type ErrorEnvelope = { error?: { code?: string; message?: string } };
export class AuthApiError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; } }
async function request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json().catch(() => ({})) as T & ErrorEnvelope;
  if (!response.ok) throw new AuthApiError(response.status, value.error?.code ?? 'REQUEST_FAILED', value.error?.message ?? 'Fendor could not complete this request.');
  return value;
}
export const signUp = (fullName: string, email: string, password: string, accountType:AccountType) => request<{ message: string; reviewMode?: boolean }>('/api/auth/signup', { fullName, email, password, accountType });
export const saveOnboardingProfile=(dateOfBirth:string,phone:string)=>request<{user:CurrentUser}>('/api/auth/profile',{dateOfBirth,phone});
export type VendorApplication={id:string;business_name:string;business_location:string;country:string;registration_number:string;account_type:'individual'|'company';status:string;review_note:string|null};
export const vendorApplication=()=>request<{application:VendorApplication|null}>('/api/vendor/application');
export const submitVendorApplication=(input:{businessName:string;businessLocation:string;country:string;registrationNumber:string;accountType:'individual'|'company'})=>request<{application:{id:string;status:string}}>('/api/vendor/application',input);
export const signIn = (email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/login', { email, password });
export const currentUser = () => request<{ user: CurrentUser }>('/api/auth/me');
export const signOut = () => request<{ message: string }>('/api/auth/logout', {});
export const resendVerification = (email: string) => request<{ message: string }>('/api/auth/resend-verification', { email });
export const forgotPassword = (email: string) => request<{ message: string }>('/api/auth/forgot-password', { email });
export const verifyEmail = (token: string) => request<{ message: string }>('/api/auth/verify-email', { token });
export const resetPassword = (token: string, password: string) => request<{ message: string }>('/api/auth/reset-password', { token, password });
export function safeNext(value: string | null, fallback = '/account') { return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback; }
