import type { CartItem } from './cart';

export type SavedItem = Omit<CartItem, 'quantity' | 'saved'>;

const STORAGE_KEY = 'fendor-saved:v1';
const CHANGE_EVENT = 'fendor-saved-change';

function validItem(value: unknown): value is SavedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedItem>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.vendor === 'string'
    && Number.isInteger(item.priceKobo) && item.priceKobo! >= 0 && typeof item.art === 'string'
    && typeof item.tint === 'string' && typeof item.option === 'string';
}

export function readSaved(storage: Pick<Storage, 'getItem'> = window.localStorage): SavedItem[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(validItem) : [];
  } catch { return []; }
}

export function writeSaved(items: SavedItem[], storage: Pick<Storage, 'setItem'> = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleSavedItem(item: SavedItem, storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage) {
  const current = readSaved(storage);
  const exists = current.some((candidate) => candidate.id === item.id);
  const next = exists ? current.filter((candidate) => candidate.id !== item.id) : [...current, item];
  writeSaved(next, storage);
  return { saved: !exists, items: next };
}

export function isSaved(id: string, storage: Pick<Storage, 'getItem'> = window.localStorage) {
  return readSaved(storage).some((item) => item.id === id);
}

export function subscribeToSaved(listener: () => void) {
  const storageListener = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', storageListener);
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener('storage', storageListener); };
}
