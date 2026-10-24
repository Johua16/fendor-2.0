export type CatalogueProduct = {
  id: string;
  title: string;
  description: string;
  category: string;
  imagePath: string | null;
  variantId: string;
  priceKobo: number;
  currency: 'NGN';
  availability: 'confirmation_required';
};

export type OrderRequest = {
  id: string;
  productVariantId: string;
  quantity: number;
  state: string;
  version: number;
};

type ErrorEnvelope = { error?: { code?: string; message?: string } };

export class MarketplaceApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const payload = await response.json().catch(() => ({})) as T & ErrorEnvelope;
  if (!response.ok) {
    throw new MarketplaceApiError(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'Fendor could not complete this request.');
  }
  return payload;
}

export async function listProducts(filters: { q?: string; category?: string; limit?: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(filters.limit ?? 50) });
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  return requestJson<{ products: CatalogueProduct[]; nextCursor: string | null }>(`/api/products?${params}`, { signal });
}

export async function getProduct(id: string, signal?: AbortSignal) {
  return requestJson<{ product: CatalogueProduct }>(`/api/products/${encodeURIComponent(id)}`, { signal });
}

export async function createOrderRequest(productVariantId: string, quantity: number, clientRequestId: string) {
  return requestJson<{ order: OrderRequest }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ clientRequestId, productVariantId, quantity }),
  });
}
