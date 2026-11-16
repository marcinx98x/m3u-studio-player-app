import type { XtreamEpgListing } from '../../types/xtream';
import { decodeEpgTitle, epgEndMs, epgStartMs, formatTime } from '../../utils/epg';

interface EpgNowBarProps {
  streamId: number | null;
  channelName?: string;
  epgNow: XtreamEpgListing | null;
  epgNext: XtreamEpgListing | null;
  epgLoading: boolean;
  displayTimeZone?: string;
}

export default function EpgNowBar({
  streamId,
  channelName,
  epgNow,
  epgNext,
  epgLoading,
  displayTimeZone,
}: EpgNowBarProps) {
  if (!streamId) {
    return (
      <div className="epg-now-bar epg-now-muted small">
        Wybierz kanał, aby zobaczyć program.
      </div>
    );
  }

  return (
    <div className="epg-now-bar">
      <div className="fw-semibold">{channelName}</div>
      {epgLoading && <span className="small epg-now-muted">Ładowanie EPG…</span>}
      {!epgLoading && epgNow && (
        <div className="small">
          <span className="epg-now-label">Teraz:</span>{' '}
          {decodeEpgTitle(epgNow.title)} ({formatTime(epgStartMs(epgNow), displayTimeZone)}–
          {formatTime(epgEndMs(epgNow), displayTimeZone)})
        </div>
      )}
      {!epgLoading && epgNext && (
        <div className="small epg-now-label">
          Potem: {decodeEpgTitle(epgNext.title)} ({formatTime(epgStartMs(epgNext), displayTimeZone)}–
          {formatTime(epgEndMs(epgNext), displayTimeZone)})
        </div>
      )}
      {!epgLoading && !epgNow && (
        <div className="small epg-now-muted">Brak danych EPG dla tego kanału.</div>
      )}
    </div>
  );
}
