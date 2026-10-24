export type CartItem = {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  vendor: string;
  priceKobo: number;
  oldPriceKobo?: number;
  quantity: number;
  art: string;
  tint: string;
  imagePath?: string | null;
  option: string;
  saved?: boolean;
};

const STORAGE_KEY = 'fendor-cart:v1';
const CHANGE_EVENT = 'fendor-cart-change';

function validItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CartItem>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.vendor === 'string'
    && Number.isInteger(item.priceKobo) && item.priceKobo! >= 0 && Number.isInteger(item.quantity)
    && item.quantity! >= 1 && item.quantity! <= 10 && typeof item.art === 'string'
    && typeof item.tint === 'string' && typeof item.option === 'string';
}

export function readCart(storage: Pick<Storage, 'getItem'> = window.localStorage): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(validItem) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[], storage: Pick<Storage, 'setItem'> = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function addCartItem(item: Omit<CartItem, 'quantity'> & { quantity?: number }, storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage) {
  const quantity = Math.min(10, Math.max(1, item.quantity ?? 1));
  const current = readCart(storage);
  const existing = current.find((candidate) => candidate.id === item.id);
  const next = existing
    ? current.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: Math.min(10, candidate.quantity + quantity) } : candidate)
    : [...current, { ...item, quantity }];
  writeCart(next, storage);
  return next;
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function subscribeToCart(listener: () => void) {
  const storageListener = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', storageListener);
  };
}

export function cartStorageKey() {
  return STORAGE_KEY;
}

