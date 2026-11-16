import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  channelHasArchive,
  getSimpleDataTable,
  type XtreamCredentials,
} from '../../api/xtreamClient';
import { useNowTick } from '../../hooks/useNowTick';
import type { XtreamEpgListing, XtreamLiveStream } from '../../types/xtream';
import { listingsMatch } from '../../utils/epgArchive';
import {
  dedupeEpgListings,
  decodeEpgTitle,
  epgEndMs,
  epgListingAirState,
  epgStartMs,
  formatTime,
  groupEpgListingsByDay,
  trimPastEpgListings,
} from '../../utils/epg';

interface EpgGridProps {
  creds: XtreamCredentials;
  channel: XtreamLiveStream | null;
  displayTimeZone?: string;
  onPlayCatchup?: (listing: XtreamEpgListing) => void;
  playingEpgListing?: XtreamEpgListing | null;
  variant?: 'page' | 'drawer';
}

function EpgRow({
  item,
  idx,
  channel,
  now,
  displayTimeZone,
  onPlayCatchup,
  playingEpgListing,
  shouldScrollTo,
  rowRef,
  rowClickable,
  compact,
}: {
  item: XtreamEpgListing;
  idx: number;
  channel: XtreamLiveStream;
  now: number;
  displayTimeZone?: string;
  onPlayCatchup?: (listing: XtreamEpgListing) => void;
  playingEpgListing?: XtreamEpgListing | null;
  shouldScrollTo?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
  rowClickable?: boolean;
  compact?: boolean;
}) {
  const startMs = epgStartMs(item);
  const endMs = epgEndMs(item);
  const airState = epgListingAirState(item, now);
  const isPast = airState === 'past';
  const canArchive = isPast && (item.has_archive === 1 || channelHasArchive(channel));
  const clickable = rowClickable && canArchive && onPlayCatchup && startMs > 0;

  const isPlaying = playingEpgListing
    ? listingsMatch(item, playingEpgListing)
    : airState === 'live';

  const rowClass = isPlaying
    ? 'epg-row--live'
    : airState === 'past'
      ? 'epg-row--past'
      : '';

  const handleRowClick = () => {
    if (clickable) onPlayCatchup(item);
  };

  const handleRowKeyDown = (e: KeyboardEvent) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlayCatchup(item);
    }
  };

  return (
    <div
      key={`${item.id ?? idx}-${startMs}`}
      ref={shouldScrollTo ? rowRef : undefined}
      className={`list-group-item epg-row ${rowClass}${clickable ? ' epg-row--clickable' : ''}`.trim()}
      {...(isPlaying ? { 'data-epg-playing': true } : {})}
      {...(clickable
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: handleRowClick,
            onKeyDown: handleRowKeyDown,
          }
        : {})}
    >
      <div className="d-flex justify-content-between gap-2">
        <div>
          <div className="epg-row-title">{decodeEpgTitle(item.title)}</div>
          <div className="epg-row-time">
            {formatTime(startMs, displayTimeZone)} – {formatTime(endMs, displayTimeZone)}
          </div>
          {!compact && item.description && (
            <div className="mt-1 epg-row-description">
              {decodeEpgTitle(item.description)}
            </div>
          )}
        </div>
        {canArchive && onPlayCatchup && startMs > 0 && !rowClickable && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary align-self-start"
            onClick={() => onPlayCatchup(item)}
          >
            Odtwórz
          </button>
        )}
      </div>
    </div>
  );
}

export default function EpgGrid({
  creds,
  channel,
  displayTimeZone,
  onPlayCatchup,
  playingEpgListing,
  variant = 'page',
}: EpgGridProps) {
  const isDrawer = variant === 'drawer';
  const [listings, setListings] = useState<XtreamEpgListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowMs = useNowTick(30_000);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const targetRowRef = useRef<HTMLDivElement | null>(null);
  const lastScrollKeyRef = useRef('');

  useEffect(() => {
    if (!channel) {
      setListings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSimpleDataTable(creds, channel.stream_id)
      .then((data) => {
        if (!cancelled) setListings(data.epg_listings ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Błąd EPG');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creds, channel]);

  const dayGroups = useMemo(() => {
    const unique = dedupeEpgListings(listings);
    const trimmed = trimPastEpgListings(unique, nowMs);
    return groupEpgListingsByDay(trimmed, displayTimeZone);
  }, [listings, nowMs, displayTimeZone]);

  const hasArchiveFlag = Boolean(channel && channelHasArchive(channel));
  const hasArchivablePast = useMemo(
    () =>
      listings.some(
        (item) =>
          epgListingAirState(item, nowMs) === 'past' &&
          (item.has_archive === 1 || (channel ? channelHasArchive(channel) : false)),
      ),
    [listings, nowMs, channel],
  );

  useEffect(() => {
    if (!channel || loading || dayGroups.length === 0) return;
    const key = `${channel.stream_id}:${playingEpgListing?.id ?? ''}:${epgStartMs(playingEpgListing ?? {})}`;
    if (lastScrollKeyRef.current === key) return;

    const target =
      targetRowRef.current ??
      scrollRef.current?.querySelector('[data-epg-playing="true"]');
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    lastScrollKeyRef.current = key;
  }, [channel, dayGroups, loading, playingEpgListing]);

  if (!channel) {
    return (
      <p className="text-muted small p-3">
        {isDrawer ? 'Wybierz kanał, aby zobaczyć program.' : 'Wybierz kanał na zakładce Live.'}
      </p>
    );
  }

  return (
    <div className={`epg-grid${isDrawer ? ' epg-grid--drawer' : ' p-3'}`}>
      <h6 className={`epg-grid-channel-title${isDrawer ? ' mb-2' : ' mb-3'}`}>
        Program: {channel.name}
        {channelHasArchive(channel) && (
          <span className="epg-grid-archive-label">, Archiwum Dostępne</span>
        )}
      </h6>
      {isDrawer && hasArchivablePast && (
        <p className="epg-drawer-hint small mb-2">Kliknij audycję archiwalną, aby odtworzyć.</p>
      )}
      {loading && <p className="epg-empty-hint small">Ładowanie…</p>}
      {error && <div className="alert alert-warning py-2">{error}</div>}
      {!loading && !error && hasArchiveFlag && !hasArchivablePast && (
        <div className="alert alert-info py-2">
          Kanał ma flagę archiwum, ale API nie zwróciło audycji archiwalnych. To zwykle oznacza, że
          dostawca nie udostępnia catchup dla tego kanału.
        </div>
      )}
      <div className="list-group list-group-flush epg-grid-scroll" ref={scrollRef}>
        {dayGroups.map((group) => (
          <section key={group.dayKey || 'other'} className="epg-day-group">
            <h6 className="epg-day-group-title">{group.label}</h6>
            {group.items.map((item, idx) => {
              const isPlaying = playingEpgListing
                ? listingsMatch(item, playingEpgListing)
                : epgListingAirState(item, nowMs) === 'live';
              return (
                <EpgRow
                  key={`${group.dayKey}-${item.id ?? idx}-${epgStartMs(item)}`}
                  item={item}
                  idx={idx}
                  channel={channel}
                  now={nowMs}
                  displayTimeZone={displayTimeZone}
                  onPlayCatchup={onPlayCatchup}
                  playingEpgListing={playingEpgListing}
                  shouldScrollTo={isPlaying}
                  rowClickable={isDrawer}
                  compact={isDrawer}
                  rowRef={(el) => {
                    if (isPlaying) targetRowRef.current = el;
                  }}
                />
              );
            })}
          </section>
        ))}
        {!loading && listings.length === 0 && !error && (
          <p className="epg-empty-hint small">
            Brak wpisów EPG w API playera dla tego kanału. Jeśli w M3U Studio program się
            wyświetla, odśwież stronę playera (Ctrl+F5) po aktualizacji serwera.
          </p>
        )}
      </div>
    </div>
  );
}
