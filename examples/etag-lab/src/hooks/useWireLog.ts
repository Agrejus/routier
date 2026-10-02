import { useEffect, useState } from 'react';
import { labApi } from '../labApi';
import type { WireEntry } from '../wire';

const POLL_MS = 400;

export const useWireLog = (): WireEntry[] => {
  const [entries, setEntries] = useState<WireEntry[]>([]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const next = await labApi.log().catch(() => null);

      if (active && next != null) {
        setEntries(next);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return entries;
};
