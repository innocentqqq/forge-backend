import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { api, USE_MOCK_API } from './api';
import type { MarketplaceOrder } from './marketplace-types';
import { ORDER_POLL_COMPLETE_STATUSES } from './order-status';

const POLL_INTERVAL_MS = USE_MOCK_API ? 1000 : 3000;

function isOrderComplete(order: MarketplaceOrder) {
  return ORDER_POLL_COMPLETE_STATUSES.includes(order.status);
}

export function useMarketplaceOrders() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await api.getMarketplaceOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { orders, loading, error, reload: load };
}

export function useMarketplaceOrder(id: string | undefined) {
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const completeRef = useRef(false);
  const reload = useCallback(() => setRefreshToken((token) => token + 1), []);

  useFocusEffect(
    useCallback(() => {
      // `reload()` bumps this token to restart the focus/poll effect immediately.
      void refreshToken;
      let focused = true;
      let timer: ReturnType<typeof setInterval> | undefined;
      completeRef.current = false;

      const refresh = async (initial: boolean) => {
        if (!id || completeRef.current) return;
        if (initial) setLoading(true);
        try {
          const next = await api.getMarketplaceOrder(id);
          if (!focused) return;
          setOrder(next);
          setError('');
          if (isOrderComplete(next)) {
            completeRef.current = true;
            if (timer) clearInterval(timer);
          }
        } catch (err) {
          if (focused) setError(err instanceof Error ? err.message : 'Could not load order.');
        } finally {
          if (focused && initial) setLoading(false);
        }
      };

      void refresh(true);
      timer = setInterval(() => { void refresh(false); }, POLL_INTERVAL_MS);
      return () => {
        focused = false;
        if (timer) clearInterval(timer);
      };
    }, [id, refreshToken]),
  );

  return { order, loading, error, reload };
}
