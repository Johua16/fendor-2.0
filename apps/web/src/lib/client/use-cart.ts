'use client';

import { useEffect, useState } from 'react';
import { CartItem, readCart, subscribeToCart, writeCart } from './cart';

export function useCart() {
  const [items, setItemsState] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setItemsState(readCart());
    refresh();
    setReady(true);
    return subscribeToCart(refresh);
  }, []);

  function setItems(next: CartItem[] | ((current: CartItem[]) => CartItem[])) {
    const resolved = typeof next === 'function' ? next(readCart()) : next;
    writeCart(resolved);
  }

  return { items, setItems, ready };
}
