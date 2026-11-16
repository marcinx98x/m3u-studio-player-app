import { useCallback, useEffect, useMemo, type RefObject } from 'react';
import { useNowTick } from '../../hooks/useNowTick';
import type { usePlaybackState } from '../../hooks/usePlaybackState';
import type { XtreamEpgListing, XtreamLiveStream } from '../../types/xtream';
import {
  epgFractionFromOffsetMs,
  epgLiveProgressFraction,
  epgStartMs,
  epgTargetMsFromFraction,
} from '../../utils/epg';
import {
  getSeekableRange,
  isLiveProgramSeekBeyondBuffer,
  seekLiveToProgramTime,
} from '../../utils/playback';
import EpgProgramScrubber from './EpgProgramScrubber';

type PlaybackApi = ReturnType<typeof usePlaybackState>;

const LIVE_EDGE_MS = 3000;
const HELD_SYNC_EPSILON = 0.03;

interface EpgProgramProgressBarProps {
  listing: XtreamEpgListing;
  displayTimeZone?: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  playback: PlaybackApi;
  activeChannel: XtreamLiveStream | null;
  channelHasArchive: boolean;
  heldScrubFraction?: number | null;
  onScrubHold?: (fraction: number) => void;
  onClearHeldScrub?: () => void;
  onPlayLive?: () => void;
  onPlayArchiveListing?: (listing: XtreamEpgListing, offsetSec?: number) => void;
}

export default function EpgProgramProgressBar({
  listing,
  displayTimeZone,
  videoRef,
  playback,
  activeChannel,
  channelHasArchive,
  heldScrubFraction = null,
  onScrubHold,
  onClearHeldScrub,
  onPlayLive,
  onPlayArchiveListing,
}: EpgProgramProgressBarProps) {
  const nowMs = useNowTick(1000);
  const liveFraction = epgLiveProgressFraction(listing, nowMs);
  const maxFraction = liveFraction ?? 1;

  const fraction = useMemo(() => {
    const video = videoRef.current;
    const startMs = epgStartMs(listing);
    if (!video || startMs <= 0) {
      return liveFraction ?? 0;
    }

    const seekable = getSeekableRange(video);
    if (seekable && seekable.end > seekable.start) {
      const now = Date.now();
      const targetMs = now - (seekable.end - video.currentTime) * 1000;
      if (targetMs >= startMs) {
        return Math.min(
          maxFraction,
          Math.max(0, epgFractionFromOffsetMs(listing, targetMs - startMs)),
        );
      }
    }

    return liveFraction ?? 0;
  }, [
    videoRef,
    listing,
    liveFraction,
    maxFraction,
    playback.currentTime,
    playback.seekEnd,
    nowMs,
  ]);

  useEffect(() => {
    if (heldScrubFraction === null || !onClearHeldScrub) return;
    if (fraction > 0.05 && Math.abs(fraction - heldScrubFraction) < HELD_SYNC_EPSILON) {
      onClearHeldScrub();
    }
  }, [fraction, heldScrubFraction, onClearHeldScrub]);

  const video = videoRef.current;
  const canScrub = Boolean(
    activeChannel && (channelHasArchive || (video && getSeekableRange(video))),
  );

  const handleFractionCommit = useCallback(
    (value: number) => {
      if (!activeChannel) return;

      onScrubHold?.(value);

      const now = Date.now();
      const targetMs = epgTargetMsFromFraction(listing, value);
      const video = videoRef.current;

      if (targetMs >= now - LIVE_EDGE_MS) {
        onPlayLive?.();
        return;
      }

      if (
        channelHasArchive &&
        onPlayArchiveListing &&
        (!video || isLiveProgramSeekBeyondBuffer(video, targetMs, now))
      ) {
        const startMs = epgStartMs(listing);
        const offsetSec = Math.max(0, (targetMs - startMs) / 1000);
        onPlayArchiveListing(listing, offsetSec);
        return;
      }

      if (video && seekLiveToProgramTime(video, targetMs, now)) {
        playback.syncFromVideo();
      }
    },
    [
      activeChannel,
      listing,
      videoRef,
      channelHasArchive,
      onScrubHold,
      onPlayLive,
      onPlayArchiveListing,
      playback,
    ],
  );

  return (
    <div className="video-player-progress video-player-progress--epg">
      <EpgProgramScrubber
        listing={listing}
        displayTimeZone={displayTimeZone}
        fraction={fraction}
        heldFraction={heldScrubFraction}
        maxFraction={maxFraction}
        disabled={!canScrub}
        ariaLabel="Postęp audycji na żywo"
        onFractionCommit={handleFractionCommit}
      />
    </div>
  );
}
