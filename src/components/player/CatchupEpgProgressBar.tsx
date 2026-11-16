import { useEffect, type RefObject } from 'react';
import type { usePlaybackState } from '../../hooks/usePlaybackState';
import type { XtreamEpgListing } from '../../types/xtream';
import { isFiniteDuration } from '../../utils/playback';
import EpgProgramScrubber from './EpgProgramScrubber';

type PlaybackApi = ReturnType<typeof usePlaybackState>;

const HELD_SYNC_EPSILON = 0.03;

interface CatchupEpgProgressBarProps {
  listing: XtreamEpgListing;
  displayTimeZone?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  playback: PlaybackApi;
  heldScrubFraction?: number | null;
  onScrubHold?: (fraction: number) => void;
  onClearHeldScrub?: () => void;
}

export default function CatchupEpgProgressBar({
  listing,
  displayTimeZone,
  videoRef,
  playback,
  heldScrubFraction = null,
  onScrubHold,
  onClearHeldScrub,
}: CatchupEpgProgressBarProps) {
  const duration = playback.duration;
  const canSeek = isFiniteDuration(duration) && duration > 0;
  const fraction = canSeek
    ? Math.min(1, Math.max(0, playback.currentTime / duration))
    : 0;

  useEffect(() => {
    if (heldScrubFraction === null || !onClearHeldScrub) return;
    if (!canSeek) return;
    if (fraction > 0.01 && Math.abs(fraction - heldScrubFraction) < HELD_SYNC_EPSILON) {
      onClearHeldScrub();
    }
  }, [fraction, heldScrubFraction, canSeek, onClearHeldScrub]);

  const handleFractionCommit = (value: number) => {
    onScrubHold?.(value);
    const video = videoRef.current;
    if (!video || !canSeek) return;
    video.currentTime = value * duration;
    playback.syncFromVideo();
  };

  return (
    <div className="video-player-progress video-player-progress--catchup">
      <EpgProgramScrubber
        listing={listing}
        displayTimeZone={displayTimeZone}
        fraction={fraction}
        heldFraction={heldScrubFraction}
        maxFraction={1}
        disabled={!canSeek}
        ariaLabel="Postęp audycji archiwalnej"
        onFractionCommit={handleFractionCommit}
      />
    </div>
  );
}
