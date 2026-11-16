import { useEffect, useState } from 'react';
import { getSimpleDataTable, type XtreamCredentials } from '../api/xtreamClient';
import type { XtreamEpgListing, XtreamLiveStream } from '../types/xtream';
import { dedupeEpgListings } from '../utils/epg';
import { filterArchivablePastListings } from '../utils/epgArchive';

export function useChannelEpgArchive(
  creds: XtreamCredentials | null,
  channel: XtreamLiveStream | null,
) {
  const [archivedListings, setArchivedListings] = useState<XtreamEpgListing[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!creds || !channel) {
      setArchivedListings([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void getSimpleDataTable(creds, channel.stream_id)
      .then((res) => {
        if (cancelled) return;
        const raw = dedupeEpgListings(res.epg_listings ?? []);
        setArchivedListings(filterArchivablePastListings(raw, channel));
      })
      .catch(() => {
        if (!cancelled) setArchivedListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [creds, channel?.stream_id, channel?.tv_archive]);

  return { archivedListings, loading };
}
