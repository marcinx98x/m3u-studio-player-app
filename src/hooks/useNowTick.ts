import { useEffect, useState } from 'react';

/** Aktualny timestamp, odświeżany co `intervalMs` (domyślnie 30 s). */
export function useNowTick(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return nowMs;
}
