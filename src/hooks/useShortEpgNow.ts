import { useEffect, useState } from 'react';
import { getShortEpg, type XtreamCredentials } from '../api/xtreamClient';
import type { XtreamEpgListing } from '../types/xtream';
import {
  epgEndMs,
  pickCurrentEpgListing,
  pickNextEpgListing,
  SHORT_EPG_FETCH_LIMIT,
} from '../utils/epg';
import { useNowTick } from './useNowTick';

const POLL_MS = 60_000;

export function useShortEpgNow(
  creds: XtreamCredentials | null | undefined,
  streamId: number | null | undefined,
) {
  const [now, setNow] = useState<XtreamEpgListing | null>(null);
  const [next, setNext] = useState<XtreamEpgListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<XtreamEpgListing[]>([]);
  const [fetchTick, setFetchTick] = useState(0);
  const clock = useNowTick(30_000);

  useEffect(() => {
    if (!creds || streamId == null) {
      setNow(null);
      setNext(null);
      setListings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getShortEpg(creds, streamId, SHORT_EPG_FETCH_LIMIT)
      .then((data) => {
        if (cancelled) return;
        const list = data.epg_listings ?? [];
        setListings(list);
        const current = pickCurrentEpgListing(list);
        setNow(current);
        setNext(pickNextEpgListing(list, current));
      })
      .catch(() => {
        if (!cancelled) {
          setNow(null);
          setNext(null);
          setListings([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creds, streamId, fetchTick]);

  // Re-pick current/next when clock advances (program may have ended)
  useEffect(() => {
    if (listings.length === 0) return;
    const current = pickCurrentEpgListing(listings);
    setNow(current);
    setNext(pickNextEpgListing(listings, current));
  }, [clock, listings]);

  // Refetch when current program ends, or every POLL_MS
  useEffect(() => {
    if (!creds || streamId == null) return;
    const endMs = now ? epgEndMs(now) : 0;
    const untilEnd = endMs > Date.now() ? endMs - Date.now() + 1500 : POLL_MS;
    const delay = Math.min(POLL_MS, Math.max(5_000, untilEnd));
    const t = window.setTimeout(() => setFetchTick((x) => x + 1), delay);
    return () => window.clearTimeout(t);
  }, [creds, streamId, now, fetchTick]);

  return { now, next, loading };
}
