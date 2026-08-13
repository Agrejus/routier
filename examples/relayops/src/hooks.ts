import { useEffect, useState } from 'react';
import { ResultType } from '@routier/core/results';
import { LiveQueryState, useQuery } from '@routier/react';

export function useLive<T>(subscribe: (callback: (result: ResultType<T>) => void) => void | (() => void), deps: unknown[] = []): LiveQueryState<T> {
  return useQuery<T>(subscribe, deps);
}

export function useHashRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const onHash = () => setRoute(get());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = (next: string) => { window.location.hash = `/${next}`; };
  return { route, navigate };
}

export const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const date = (value: Date | string | null) => value == null ? 'Unscheduled' : new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
