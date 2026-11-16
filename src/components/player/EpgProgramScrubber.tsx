import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { XtreamEpgListing } from '../../types/xtream';
import {
  decodeEpgTitle,
  epgEndMs,
  epgStartMs,
  formatTime,
} from '../../utils/epg';

function clampFraction(value: number, maxFraction: number): number {
  const max = Math.min(1, Math.max(0, maxFraction));
  return Math.min(max, Math.max(0, value));
}

function fractionFromClientX(clientX: number, rect: DOMRect, maxFraction: number): number {
  if (rect.width <= 0) return 0;
  const raw = (clientX - rect.left) / rect.width;
  return clampFraction(raw, maxFraction);
}

interface EpgProgramScrubberProps {
  listing: XtreamEpgListing;
  displayTimeZone?: string;
  /** Pozycja 0–1 na osi audycji (z wideo / EPG) */
  fraction: number;
  /** Utrzymana pozycja po seeku (rodzic — przeżywa zmianę live/catch-up) */
  heldFraction?: number | null;
  maxFraction?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onFractionCommit: (fraction: number) => void;
}

export default function EpgProgramScrubber({
  listing,
  displayTimeZone,
  fraction,
  heldFraction = null,
  maxFraction = 1,
  disabled = false,
  ariaLabel = 'Postęp audycji',
  onFractionCommit,
}: EpgProgramScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const maxFractionRef = useRef(maxFraction);
  maxFractionRef.current = maxFraction;

  const [draggingUi, setDraggingUi] = useState(false);
  const [previewFraction, setPreviewFraction] = useState<number | null>(null);

  const displayFraction = clampFraction(
    previewFraction ?? heldFraction ?? fraction,
    maxFraction,
  );
  const pct = Math.round(displayFraction * 100);
  const isHeld =
    heldFraction !== null && previewFraction === null && !draggingUi;

  const startMs = epgStartMs(listing);
  const endMs = epgEndMs(listing);
  const timeLabel = `${formatTime(startMs, displayTimeZone)} – ${formatTime(endMs, displayTimeZone)}`;
  const title = decodeEpgTitle(listing.title);

  const fractionAtClientX = (clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fractionFromClientX(clientX, rect, maxFractionRef.current);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (disabled) return;
    e.preventDefault();

    const track = trackRef.current;
    if (!track) return;

    track.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDraggingUi(true);

    const f = fractionAtClientX(e.clientX);
    if (f !== null) {
      setPreviewFraction(f);
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const next = fractionAtClientX(ev.clientX);
      if (next !== null) {
        setPreviewFraction(next);
      }
    };

    const finish = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDraggingUi(false);

      const committed = fractionAtClientX(ev.clientX);
      if (committed !== null) {
        setPreviewFraction(null);
        onFractionCommit(committed);
      } else {
        setPreviewFraction(null);
      }

      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', finish);
      track.removeEventListener('pointercancel', finish);
      if (track.hasPointerCapture(ev.pointerId)) {
        track.releasePointerCapture(ev.pointerId);
      }
    };

    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', finish);
    track.addEventListener('pointercancel', finish);
  };

  return (
    <div
      className={`epg-program-scrubber${draggingUi ? ' epg-program-scrubber--dragging' : ''}${isHeld ? ' epg-program-scrubber--sticky' : ''}${disabled ? ' epg-program-scrubber--disabled' : ''}`}
    >
      <div
        ref={trackRef}
        className="epg-program-scrubber-track"
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${title}, ${timeLabel}`}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          if (disabled) return;
          const step = 0.02;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onFractionCommit(clampFraction(fraction + step, maxFraction));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onFractionCommit(clampFraction(fraction - step, maxFraction));
          }
        }}
      >
        <div className="epg-program-progress-track" aria-hidden="true">
          <div
            className="epg-program-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="epg-program-scrubber-thumb"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="video-player-progress-epg-meta">
        <span className="video-player-progress-epg-title text-truncate">{title}</span>
        <span className="video-player-progress-time">{timeLabel}</span>
      </div>
    </div>
  );
}
