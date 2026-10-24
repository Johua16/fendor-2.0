export type CustomerNotification = { id: string; title: string; message: string; read_at: string | null; created_at: string };
export type SupportCaseSummary = { id: string; order_id: string | null; status: 'open' | 'waiting_customer' | 'resolved'; subject: string; version: number; assigned_to: string | null };
export type SupportMessage = { id: string; body: string; internal: false; created_at: string; author: 'you' | 'Fendor' };
export type SupportCase = SupportCaseSummary & { messages: SupportMessage[]; nextCursor: string | null };
export type OrderRemedy = { id: string; kind: 'cancellation' | 'return'; status: 'requested' | 'approved' | 'rejected' | 'closed'; reason: string; refund_limit_kobo: string | number; review_note: string | null; restock_quantity: number | null };
type ErrorEnvelope = { error?: { code?: string; message?: string } };

export class CustomerServiceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  const payload = await response.json().catch(() => ({})) as T & ErrorEnvelope;
  if (!response.ok) throw new CustomerServiceError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'Fendor could not complete this request.');
  return payload;
}

export function listNotifications(signal?: AbortSignal) {
  return requestJson<{ notifications: CustomerNotification[]; nextCursor: string | null }>('/api/notifications', { signal });
}
export function markNotificationRead(id: string) {
  return requestJson<{ id: string }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: '{}' });
}
export function listSupportCases(signal?: AbortSignal) {
  return requestJson<{ cases: SupportCaseSummary[]; nextCursor: string | null }>('/api/support', { signal });
}
export function getSupportCase(id: string, signal?: AbortSignal) {
  return requestJson<SupportCase>(`/api/support/${encodeURIComponent(id)}`, { signal });
}
export function createSupportCase(input: { requestId: string; subject: string; message: string; orderId?: string }) {
  return requestJson<{ id: string; version: number }>('/api/support', { method: 'POST', body: JSON.stringify(input) });
}
export function replyToSupportCase(id: string, version: number, message: string) {
  return requestJson<{ id: string; status: 'open'; version: number }>(`/api/support/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ version, message }) });
}
export function getOrderRemedy(id: string, signal?: AbortSignal) {
  return requestJson<OrderRemedy | null>(`/api/orders/${encodeURIComponent(id)}/remedy`, { signal });
}
export function requestOrderRemedy(id: string, version: number, kind: 'cancellation' | 'return', note: string) {
  return requestJson<{ orderId: string; state: string; version: number }>(`/api/orders/${encodeURIComponent(id)}/request-remedy`, { method: 'POST', body: JSON.stringify({ version, kind, note }) });
}
