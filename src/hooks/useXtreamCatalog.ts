import { useCallback, useEffect, useState } from 'react';
import {
  getLiveCatalog,
  getLiveCategories,
  getLiveStreams,
  getSeries,
  getVodStreams,
  type XtreamCredentials,
} from '../api/xtreamClient';
import type { XtreamCategory, XtreamLiveStream, XtreamSeries, XtreamVodStream } from '../types/xtream';

export interface XtreamCatalog {
  liveCategories: XtreamCategory[];
  liveStreams: XtreamLiveStream[];
  vodStreams: XtreamVodStream[];
  seriesList: XtreamSeries[];
  loading: boolean;
  error: string | null;
  vodTruncated: boolean;
  reload: () => void;
}

const VOD_LIST_CAP = 2000;

async function loadLiveWithFallback(creds: XtreamCredentials): Promise<{
  categories: XtreamCategory[];
  streams: XtreamLiveStream[];
}> {
  try {
    const catalog = await getLiveCatalog(creds);
    if (catalog.streams.length > 0 || catalog.categories.length > 0) {
      return catalog;
    }
  } catch {
    /* fall through to split endpoints */
  }
  const [categories, streams] = await Promise.all([
    getLiveCategories(creds),
    getLiveStreams(creds),
  ]);
  return { categories, streams };
}

export function useXtreamCatalog(creds: XtreamCredentials | null): XtreamCatalog {
  const [liveCategories, setLiveCategories] = useState<XtreamCategory[]>([]);
  const [liveStreams, setLiveStreams] = useState<XtreamLiveStream[]>([]);
  const [vodStreams, setVodStreams] = useState<XtreamVodStream[]>([]);
  const [seriesList, setSeriesList] = useState<XtreamSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vodTruncated, setVodTruncated] = useState(false);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!creds) {
      setLiveCategories([]);
      setLiveStreams([]);
      setVodStreams([]);
      setSeriesList([]);
      setVodTruncated(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const live = await loadLiveWithFallback(creds);
        if (cancelled) return;
        setLiveCategories(live.categories);
        setLiveStreams(live.streams);

        const [vodResult, seriesResult] = await Promise.allSettled([
          getVodStreams(creds),
          getSeries(creds),
        ]);
        if (cancelled) return;

        if (vodResult.status === 'fulfilled') {
          const all = vodResult.value;
          setVodTruncated(all.length > VOD_LIST_CAP);
          setVodStreams(all.slice(0, VOD_LIST_CAP));
        } else {
          setVodStreams([]);
          setVodTruncated(false);
        }

        if (seriesResult.status === 'fulfilled') {
          setSeriesList(seriesResult.value);
        } else {
          setSeriesList([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Nie udało się załadować listy kanałów');
          setLiveCategories([]);
          setLiveStreams([]);
          setVodStreams([]);
          setSeriesList([]);
          setVodTruncated(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creds, tick]);

  return {
    liveCategories,
    liveStreams,
    vodStreams,
    seriesList,
    loading,
    error,
    vodTruncated,
    reload,
  };
}
