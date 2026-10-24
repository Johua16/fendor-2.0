'use client';

import { useEffect, useState } from 'react';
import { readSaved, SavedItem, subscribeToSaved, writeSaved } from './saved';

export function useSaved() {
  const [items, setState] = useState<SavedItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => { setState(readSaved()); setReady(true); };
    refresh();
    return subscribeToSaved(refresh);
  }, []);
  const setItems = (update: SavedItem[] | ((items: SavedItem[]) => SavedItem[])) => {
    const next = typeof update === 'function' ? update(readSaved()) : update;
    writeSaved(next);
  };
  return { items, setItems, ready };
}
