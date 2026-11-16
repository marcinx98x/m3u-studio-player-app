import { useCallback, useEffect, useMemo, useState } from 'react';

function storageKey(username: string): string {
  return `m3u_player_favorites_${username}`;
}

function loadIds(key: string): Set<number> {
  if (!key) return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function useFavorites(username: string | undefined) {
  const key = username ? storageKey(username) : '';

  const [ids, setIds] = useState<Set<number>>(() => loadIds(key));

  useEffect(() => {
    setIds(loadIds(key));
  }, [key]);

  const persist = useCallback(
    (next: Set<number>) => {
      if (!key) return;
      localStorage.setItem(key, JSON.stringify([...next]));
      setIds(next);
    },
    [key],
  );

  const toggle = useCallback(
    (streamId: number) => {
      const next = new Set(ids);
      if (next.has(streamId)) next.delete(streamId);
      else next.add(streamId);
      persist(next);
    },
    [ids, persist],
  );

  const isFavorite = useCallback((streamId: number) => ids.has(streamId), [ids]);

  const favoriteIds = useMemo(() => [...ids], [ids]);

  return { favoriteIds, isFavorite, toggle };
}
