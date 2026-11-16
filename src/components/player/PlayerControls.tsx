import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  channelHasArchive,
  isCatchupStreamUrl,
  isLiveStreamUrl,
} from '../../api/xtreamClient';
import type { usePlaybackState } from '../../hooks/usePlaybackState';
import { getSeekableRange } from '../../utils/playback';
import { epgListingAirState } from '../../utils/epg';
import {
  buildArchiveNavigationListings,
  findAdjacentArchiveListing,
  getLatestArchivablePastListing,
} from '../../utils/epgArchive';
import type { XtreamEpgListing, XtreamLiveStream } from '../../types/xtream';
import type { AudioTrackOption, SubtitleTrackOption } from '../../lib/hlsCodecSupport';
import CatchupEpgProgressBar from './CatchupEpgProgressBar';
import EpgProgramProgressBar from './EpgProgramProgressBar';
import MediaTrackSelector from './MediaTrackSelector';
import PlayerProgressBar from './PlayerProgressBar';

type PlaybackApi = ReturnType<typeof usePlaybackState>;

const LIVE_EDGE_OFFSET_SEC = 2;
const LIVE_BEHIND_THRESHOLD_SEC = 5;
const HELD_SYNC_EPSILON = 0.03;

interface PlayerControlsProps {
  visible: boolean;
  streamUrl: string;
  playback: PlaybackApi;
  videoRef: RefObject<HTMLVideoElement | null>;
  wrapRef: RefObject<HTMLDivElement | null>;
  activeChannel?: XtreamLiveStream | null;
  epgNow?: XtreamEpgListing | null;
  playingEpgListing?: XtreamEpgListing | null;
  archivedListings?: XtreamEpgListing[];
  displayTimeZone?: string;
  onStop?: () => void;
  onGoLive?: () => void;
  onPlayArchiveListing?: (listing: XtreamEpgListing, offsetSec?: number) => void;
  onPlayLive?: () => void;
  audioOptions?: AudioTrackOption[];
  subtitleOptions?: SubtitleTrackOption[];
  selectedAudioId?: number | null;
  selectedSubtitleId?: number;
  onAudioChange?: (id: number) => void;
  onSubtitleChange?: (id: number) => void;
}

export default function PlayerControls({
  visible,
  streamUrl,
  playback,
  videoRef,
  wrapRef,
  activeChannel = null,
  epgNow = null,
  playingEpgListing = null,
  archivedListings = [],
  displayTimeZone,
  onStop,
  onGoLive,
  onPlayArchiveListing,
  onPlayLive,
  audioOptions = [],
  subtitleOptions = [],
  selectedAudioId = null,
  selectedSubtitleId = -1,
  onAudioChange,
  onSubtitleChange,
}: PlayerControlsProps) {
  const [pipSupported, setPipSupported] = useState(false);
  const [heldScrubFraction, setHeldScrubFraction] = useState<number | null>(null);
  const scrubCommitPendingRef = useRef(false);

  const isLive = isLiveStreamUrl(streamUrl);
  const isCatchup = isCatchupStreamUrl(streamUrl);
  const showLiveButton = isLive || isCatchup;
  const channelArchive = activeChannel ? channelHasArchive(activeChannel) : false;

  const showEpgProgress =
    isLive &&
    epgNow !== null &&
    epgListingAirState(epgNow) === 'live';

  const showCatchupEpgProgress = isCatchup && playingEpgListing !== null;

  const archiveNavListings = useMemo(() => {
    if (!activeChannel || !playingEpgListing) return archivedListings;
    return buildArchiveNavigationListings(
      archivedListings,
      playingEpgListing,
      activeChannel,
    );
  }, [archivedListings, playingEpgListing, activeChannel]);

  const prevListing = useMemo(() => {
    if (!playingEpgListing || archiveNavListings.length === 0) return null;
    return findAdjacentArchiveListing(archiveNavListings, playingEpgListing, 'prev');
  }, [playingEpgListing, archiveNavListings]);

  const nextListing = useMemo(() => {
    if (!playingEpgListing || archiveNavListings.length === 0) return null;
    return findAdjacentArchiveListing(archiveNavListings, playingEpgListing, 'next');
  }, [playingEpgListing, archiveNavListings]);

  const latestPastForLive = useMemo(() => {
    if (!activeChannel || archivedListings.length === 0) return null;
    return getLatestArchivablePastListing(archivedListings, activeChannel);
  }, [activeChannel, archivedListings]);

  const showArchiveNav = isCatchup && Boolean(onPlayArchiveListing);
  const showLivePrevArchive =
    isLive &&
    !isCatchup &&
    channelArchive &&
    Boolean(onPlayArchiveListing) &&
    latestPastForLive !== null;

  const isBehindLive = useMemo(() => {
    if (isCatchup) return true;
    if (!isLive) return false;
    const video = videoRef.current;
    if (!video) return false;
    const seekable = getSeekableRange(video);
    if (!seekable) return false;
    return playback.currentTime < seekable.end - LIVE_BEHIND_THRESHOLD_SEC;
  }, [isCatchup, isLive, videoRef, playback.currentTime, playback.seekEnd]);

  /** Żółty przycisk tylko na żywo przy krawędzi HLS; cofnięcie / archiwum = szary. */
  const isAtLiveEdge =
    isLive && !isCatchup && !isBehindLive && playingEpgListing === null;

  useEffect(() => {
    setPipSupported(
      typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        Boolean(document.pictureInPictureEnabled),
    );
  }, []);

  const onScrubHold = useCallback((fraction: number) => {
    scrubCommitPendingRef.current = true;
    setHeldScrubFraction(fraction);
  }, []);

  const onClearHeldScrub = useCallback(() => {
    setHeldScrubFraction(null);
  }, []);

  useEffect(() => {
    if (scrubCommitPendingRef.current) {
      scrubCommitPendingRef.current = false;
      return;
    }
    setHeldScrubFraction(null);
  }, [streamUrl]);

  useEffect(() => {
    if (heldScrubFraction === null || !isCatchup) return;
    const duration = playback.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const actual = playback.currentTime / duration;
    if (actual > 0.01 && Math.abs(actual - heldScrubFraction) < HELD_SYNC_EPSILON) {
      setHeldScrubFraction(null);
    }
  }, [
    isCatchup,
    playback.currentTime,
    playback.duration,
    heldScrubFraction,
  ]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, [wrapRef]);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* ignore unsupported */
    }
  }, [videoRef, pipSupported]);

  const seekToLiveEdge = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const seekable = getSeekableRange(video);
    if (seekable) {
      video.currentTime = Math.max(
        seekable.start,
        seekable.end - LIVE_EDGE_OFFSET_SEC,
      );
      playback.syncFromVideo();
    }
  }, [videoRef, playback]);

  const handleGoLive = useCallback(() => {
    if (isCatchup) {
      onGoLive?.();
      return;
    }
    seekToLiveEdge();
  }, [isCatchup, onGoLive, seekToLiveEdge]);

  return (
    <div
      className={`video-player-controls${visible ? ' video-player-controls--visible' : ''}`}
      title="Skróty: Spacja odtwórz/pauza, F pełny ekran, M wycisz, S stop"
    >
      <div className="video-player-controls-buttons">
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={playback.play}
          disabled={!playback.paused}
          aria-label="Odtwórz"
        >
          ▶
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={playback.pause}
          disabled={playback.paused}
          aria-label="Pauza"
        >
          ⏸
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={() => onStop?.()}
          disabled={!onStop}
          aria-label="Zatrzymaj odtwarzanie"
        >
          ■ Stop
        </button>
        {(showArchiveNav || showLivePrevArchive) && (
          <button
            type="button"
            className="btn btn-sm btn-outline-light btn-archive-nav"
            onClick={() => {
              const target = isCatchup ? prevListing : latestPastForLive;
              if (target) onPlayArchiveListing?.(target);
            }}
            disabled={isCatchup ? !prevListing : !latestPastForLive}
            aria-label="Poprzednia audycja"
          >
            ◀ Poprz.
          </button>
        )}
        {showArchiveNav && (
          <button
            type="button"
            className="btn btn-sm btn-outline-light btn-archive-nav"
            onClick={() => nextListing && onPlayArchiveListing?.(nextListing)}
            disabled={!nextListing}
            aria-label="Następna audycja"
          >
            Nast. ▶
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={playback.toggleMute}
          aria-label={playback.muted ? 'Włącz dźwięk' : 'Wycisz'}
        >
          {playback.muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          className="video-player-volume-range"
          min={0}
          max={1}
          step={0.05}
          value={playback.muted ? 0 : playback.volume}
          onChange={(e) => playback.setVolume(Number(e.target.value))}
          aria-label="Głośność"
        />
        {onAudioChange && onSubtitleChange && (
          <MediaTrackSelector
            audioOptions={audioOptions}
            subtitleOptions={subtitleOptions}
            selectedAudioId={selectedAudioId}
            selectedSubtitleId={selectedSubtitleId}
            onAudioChange={onAudioChange}
            onSubtitleChange={onSubtitleChange}
          />
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-light ms-auto"
          onClick={toggleFullscreen}
          aria-label="Pełny ekran"
        >
          ⛶
        </button>
        {pipSupported && (
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={() => void togglePiP()}
            aria-label="Obraz w obrazie"
          >
            PiP
          </button>
        )}
        {showLiveButton && (
          <button
            type="button"
            className={`btn btn-sm btn-live${isAtLiveEdge ? ' btn-warning' : ' btn-outline-light'}`}
            onClick={handleGoLive}
            disabled={isAtLiveEdge || (isCatchup && !onGoLive)}
            aria-label="Powrót na żywo"
          >
            Live
          </button>
        )}
      </div>
      {showCatchupEpgProgress && playingEpgListing ? (
        <CatchupEpgProgressBar
          listing={playingEpgListing}
          displayTimeZone={displayTimeZone}
          videoRef={videoRef}
          playback={playback}
          heldScrubFraction={heldScrubFraction}
          onScrubHold={onScrubHold}
          onClearHeldScrub={onClearHeldScrub}
        />
      ) : showEpgProgress && epgNow ? (
        <EpgProgramProgressBar
          listing={epgNow}
          displayTimeZone={displayTimeZone}
          videoRef={videoRef}
          playback={playback}
          activeChannel={activeChannel}
          channelHasArchive={channelArchive}
          heldScrubFraction={heldScrubFraction}
          onScrubHold={onScrubHold}
          onClearHeldScrub={onClearHeldScrub}
          onPlayLive={onPlayLive}
          onPlayArchiveListing={onPlayArchiveListing}
        />
      ) : (
        <PlayerProgressBar
          currentTime={playback.currentTime}
          duration={playback.duration}
          bufferedEnd={playback.bufferedEnd}
          seekStart={playback.seekStart}
          seekEnd={playback.seekEnd}
          videoRef={videoRef}
          onSeeked={playback.syncFromVideo}
          hideBufferBar={isLive}
        />
      )}
    </div>
  );
}
