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
export type VendorProduct=CatalogueProduct&{status:'draft'|'under_review'|'approved'|'paused'|'rejected';version:number;reviewNote:string|null;sku:string;stockQuantity:number;reservedQuantity:number};

export type OrderRequest = {
  id: string;
  productVariantId: string;
  quantity: number;
  state: 'draft' | 'checking_availability' | 'reserved' | 'awaiting_payment' | 'confirmed' | 'preparing' | 'ready_for_dispatch' | 'out_for_delivery' | 'delivered' | 'unavailable' | 'cancelled' | 'delivery_failed' | 'returned' | 'refunded';
  version: number;
  product: { title: string; imagePath: string | null; unitPriceKobo: number; currency: 'NGN'; productVersion: number };
  giftDetails: { recipientName?: string; occasion?: string; relationship?: string; giftMessage?: string; packagingPreference?: string };
  reservationExpiresAt: string | null;
  reservationExpired: boolean;
  financialHold?: boolean;
  orderConfirmed: boolean;
  quoteId?: string | null;
  acceptedQuoteId?: string | null;
  totalKobo?: number | null;
};

export type CheckoutSummary = {
  orderId: string;
  version: number;
  state: OrderRequest['state'];
  quote: null | { id: string; details: { productSubtotalKobo: number; packagingKobo: number; deliveryKobo: number; totalKobo: number; currency: 'NGN'; fulfilmentPlan: string; fulfilmentChecked: true } };
  acceptedQuoteId: string | null;
  orderConfirmed: boolean;
  reservationExpiresAt: string | null;
  reservationActive: boolean;
  fundsRecorded: boolean;
  netReceivedKobo: string;
  refundedKobo: string;
  paymentInstructions?: null | { bankName: string; accountName: string; accountNumber: string };
};

export type DeliveryZone = { id: string; name: string; state: string; city: string; version: number };
export type DeliveryDetails = { recipientName: string; phone: string; address: string; instructions: string; state: string; city: string; country: 'NG'; deliveryDate: string; proofId: string | null; trackingReference: string | null; attempts: number };
export type OrderHistoryEvent = { id: string; from_state: string; to_state: string; event_type: string; order_version: number; created_at: string };

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
export async function listVendorProducts(signal?:AbortSignal){return requestJson<{products:VendorProduct[];nextCursor:string|null}>('/api/vendor/products?limit=50',{signal});}
export async function createVendorProduct(input:{title:string;description:string;category:string;imagePath:string|null;sku:string;priceKobo:number;stockQuantity:number}){return requestJson<{product:VendorProduct}>('/api/vendor/products',{method:'POST',body:JSON.stringify(input)});}
export async function submitVendorProduct(id:string,version:number){return requestJson<{product:VendorProduct}>(`/api/vendor/products/${encodeURIComponent(id)}/submit`,{method:'POST',body:JSON.stringify({version})});}
export async function pauseVendorProduct(id:string,version:number){return requestJson<{product:VendorProduct}>(`/api/vendor/products/${encodeURIComponent(id)}/pause`,{method:'POST',body:JSON.stringify({version})});}
export async function listVendorOrders(signal?:AbortSignal){return requestJson<{orders:OrderRequest[];nextCursor:string|null}>('/api/vendor/orders?limit=50',{signal});}
export async function vendorOrderAction(id:string,version:number,action:'reserve'|'decline'|'prepare'|'ready'){return requestJson<{order?:OrderRequest;orderId?:string;state:string;version:number}>(`/api/vendor/orders/${encodeURIComponent(id)}/${action}`,{method:'POST',body:JSON.stringify(action==='prepare'||action==='ready'?{version,note:action==='prepare'?'Vendor started preparing the verified order.':'Vendor confirmed the order is ready for Fendor dispatch.'}:{version})});}
export async function uploadProductImage(file:File){const response=await fetch('/api/uploads?purpose=product',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});const value=await response.json().catch(()=>({})) as {id?:string;imagePath?:string;status?:string;error?:{message?:string}};if(!response.ok)throw new MarketplaceApiError(response.status,'UPLOAD_FAILED',value.error?.message??'Fendor could not upload this image.');return value as {id:string;imagePath:string;status:'pending'};}
export type VendorProfile={user_id:string;document_id:string;window_start:string;window_end:string;version:number;phone:string;backupPhone:string;pickupAddress:string};
export async function getVendorProfile(){return requestJson<VendorProfile|null>('/api/vendor/profile');}
export async function uploadVendorDocument(file:File){const response=await fetch('/api/uploads?purpose=document',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});const value=await response.json().catch(()=>({})) as {id?:string;status?:string;error?:{message?:string}};if(!response.ok)throw new MarketplaceApiError(response.status,'UPLOAD_FAILED',value.error?.message??'Fendor could not upload this document.');return value as {id:string;status:'pending'};}
export async function saveVendorProfile(input:{version:number;phone:string;backupPhone:string;pickupAddress:string;documentId:string;windowStart:string;windowEnd:string}){return requestJson<{version:number;reviewRequired:boolean}>('/api/vendor/profile',{method:'POST',body:JSON.stringify(input)});}

export async function createOrderRequest(productVariantId: string, quantity: number, clientRequestId: string) {
  return requestJson<{ order: OrderRequest }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ clientRequestId, productVariantId, quantity }),
  });
}

export async function listOrderRequests(signal?: AbortSignal) {
  return requestJson<{ orders: OrderRequest[]; nextCursor: string | null }>('/api/orders?limit=50', { signal });
}

export async function getOrderRequest(id: string, signal?: AbortSignal) {
  return requestJson<{ order: OrderRequest }>(`/api/orders/${encodeURIComponent(id)}`, { signal });
}

export async function saveOrderPersonalisation(id: string, version: number, giftDetails: OrderRequest['giftDetails']) {
  return requestJson<{ order: OrderRequest }>(`/api/orders/${encodeURIComponent(id)}/personalise`, {
    method: 'POST', body: JSON.stringify({ version, giftDetails }),
  });
}

export async function cancelOrderRequest(id: string, version: number) {
  return requestJson<{ order: OrderRequest }>(`/api/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST', body: JSON.stringify({ version }),
  });
}

export async function getCheckoutSummary(id: string, signal?: AbortSignal) {
  return requestJson<CheckoutSummary>(`/api/orders/${encodeURIComponent(id)}/checkout`, { signal });
}

export async function acceptOrderQuote(id: string, version: number, quoteId: string, totalKobo: number) {
  return requestJson<{ orderId: string; state: 'awaiting_payment'; version: number }>(`/api/orders/${encodeURIComponent(id)}/accept-quote`, {
    method: 'POST', body: JSON.stringify({ version, quoteId, totalKobo }),
  });
}

export async function listDeliveryZones(signal?: AbortSignal) {
  return requestJson<{ zones: DeliveryZone[] }>('/api/delivery-zones', { signal });
}

export async function getDeliveryDetails(id: string, signal?: AbortSignal) {
  return requestJson<DeliveryDetails | null>(`/api/orders/${encodeURIComponent(id)}/delivery`, { signal });
}

export async function saveDeliveryDetails(id: string, input: { version: number; zoneId: string; recipientName: string; phone: string; address: string; instructions: string; deliveryDate: string }) {
  return requestJson<{ orderId: string; state: string; version: number }>(`/api/orders/${encodeURIComponent(id)}/delivery`, { method: 'POST', body: JSON.stringify(input) });
}

export async function getOrderHistory(id: string, signal?: AbortSignal) {
  return requestJson<{ events: OrderHistoryEvent[] }>(`/api/orders/${encodeURIComponent(id)}/history`, { signal });
}
