import Hls, { type HlsConfig } from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaybackState } from '../../hooks/usePlaybackState';
import { usePlayerControlsVisibility } from '../../hooks/usePlayerControlsVisibility';
import { usePlayerKeyboard } from '../../hooks/usePlayerKeyboard';
import {
  applyBestAudioTrack,
  buildAudioTrackOptions,
  buildSubtitleTrackOptions,
  debugLogCodecs,
  DOLBY_AUDIO_MESSAGE,
  ensureVideoUnmuted,
  formatAudioErrorMessage,
  getManifestAudioBlockReason,
  getPlaybackAudioIssue,
  isHlsAudioCodecError,
  pickLevelWithBrowserAudio,
  type AudioTrackOption,
  type SubtitleTrackOption,
} from '../../lib/hlsCodecSupport';
import { isCatchupStreamUrl } from '../../api/xtreamClient';
import { getXtreamBase } from '../../config/env';
import { isAllowedStreamUrl } from '../../lib/streamUrlAllow';
import type { XtreamEpgListing, XtreamLiveStream } from '../../types/xtream';
import PlayerControls from './PlayerControls';

const CATCHUP_ERROR_HINT =
  ' Sprawdź w Studio: archiwum kanału (tv_archive) i szablon catch-up (Flussonic).';

interface VideoPlayerProps {
  streamUrl: string | null;
  title?: string;
  onStop?: () => void;
  onGoLive?: () => void;
  activeChannel?: XtreamLiveStream | null;
  epgNow?: XtreamEpgListing | null;
  playingEpgListing?: XtreamEpgListing | null;
  archivedListings?: XtreamEpgListing[];
  displayTimeZone?: string;
  onPlayArchiveListing?: (listing: XtreamEpgListing, offsetSec?: number) => void;
  onPlayLive?: () => void;
  pendingCatchupOffsetSec?: number | null;
  onPendingCatchupSeekApplied?: () => void;
  /** server_info.audio_transcode === 1 from Xtream API */
  audioTranscodeAvailable?: boolean;
}

const SILENT_CHECK_MS = 2500;
const MAX_FATAL_RETRIES = 3;

function buildHlsConfig(): Partial<HlsConfig> {
  return {
    enableWorker: true,
    lowLatencyMode: false,
    capLevelToPlayerSize: true,
    defaultAudioCodec: 'mp4a.40.2',
    enableWebVTT: true,
    renderTextTracksNatively: false,
    xhrSetup: (xhr) => {
      xhr.withCredentials = false;
    },
  };
}

export default function VideoPlayer({
  streamUrl,
  title,
  onStop,
  onGoLive,
  activeChannel = null,
  epgNow = null,
  playingEpgListing = null,
  archivedListings = [],
  displayTimeZone,
  onPlayArchiveListing,
  onPlayLive,
  pendingCatchupOffsetSec = null,
  onPendingCatchupSeekApplied,
  audioTranscodeAvailable = false,
}: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const userPickedAudioRef = useRef(false);
  const userPickedSubtitleRef = useRef(false);
  const levelOnlyAudioCheckedRef = useRef(false);
  const playbackCtxRef = useRef({ browserAudio: true, manifestBlocked: false });
  const [error, setError] = useState<string | null>(null);
  const [audioBanner, setAudioBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioOptions, setAudioOptions] = useState<AudioTrackOption[]>([]);
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleTrackOption[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(-1);
  const [reloadToken, setReloadToken] = useState(0);
  const fatalRetriesRef = useRef(0);
  const loadedUrlRef = useRef<string | null>(null);

  const playback = usePlaybackState(videoRef, streamUrl);

  const retryPlayback = useCallback(() => {
    fatalRetriesRef.current = 0;
    setError(null);
    setReloadToken((t) => t + 1);
  }, []);

  const syncTracksFromHls = useCallback((hls: Hls) => {
    setAudioOptions(buildAudioTrackOptions(hls.audioTracks));
    setSubtitleOptions(buildSubtitleTrackOptions(hls.subtitleTracks));
    setSelectedAudioId(hls.audioTrack >= 0 ? hls.audioTrack : null);
    setSelectedSubtitleId(hls.subtitleTrack);
  }, []);

  const handleAudioChange = useCallback((id: number) => {
    userPickedAudioRef.current = true;
    setSelectedAudioId(id);
    const hls = hlsRef.current;
    if (hls) {
      hls.audioTrack = id;
    }
  }, []);

  const handleSubtitleChange = useCallback((id: number) => {
    userPickedSubtitleRef.current = true;
    setSelectedSubtitleId(id);
    const hls = hlsRef.current;
    if (!hls) return;
    if (id === -1) {
      hls.subtitleTrack = -1;
      hls.subtitleDisplay = false;
    } else {
      hls.subtitleTrack = id;
      hls.subtitleDisplay = true;
    }
  }, []);

  const { controlsVisible, onMouseMove, onMouseLeave, onTouchStart, onPointerDown } =
    usePlayerControlsVisibility(Boolean(streamUrl), playback.paused);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  usePlayerKeyboard({
    enabled: Boolean(streamUrl),
    onTogglePlayPause: playback.togglePlayPause,
    onToggleFullscreen: toggleFullscreen,
    onToggleMute: playback.toggleMute,
    onStop: handleStop,
  });

  useEffect(() => {
    if (pendingCatchupOffsetSec === null) return;
    const video = videoRef.current;
    if (!video) return;

    const applyOffset = () => {
      if (pendingCatchupOffsetSec === null) return;
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const target = Math.min(
        Math.max(0, pendingCatchupOffsetSec),
        Math.max(0, dur - 0.5),
      );
      video.currentTime = target;
      playback.syncFromVideo();
      onPendingCatchupSeekApplied?.();
    };

    video.addEventListener('loadedmetadata', applyOffset);
    video.addEventListener('durationchange', applyOffset);
    if (video.readyState >= 1) {
      applyOffset();
    }

    return () => {
      video.removeEventListener('loadedmetadata', applyOffset);
      video.removeEventListener('durationchange', applyOffset);
    };
  }, [
    streamUrl,
    pendingCatchupOffsetSec,
    onPendingCatchupSeekApplied,
    playback.syncFromVideo,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.removeAttribute('src');
    video.load();
    setError(null);
    setAudioBanner(null);
    setAudioOptions([]);
    setSubtitleOptions([]);
    setSelectedAudioId(null);
    setSelectedSubtitleId(-1);
    userPickedAudioRef.current = false;
    userPickedSubtitleRef.current = false;
    levelOnlyAudioCheckedRef.current = false;
    playbackCtxRef.current = { browserAudio: true, manifestBlocked: false };

    if (!streamUrl) {
      setLoading(false);
      return;
    }

    if (!isAllowedStreamUrl(streamUrl, getXtreamBase())) {
      setLoading(false);
      setError('Niedozwolony adres strumienia.');
      return;
    }

    setLoading(true);
    if (loadedUrlRef.current !== streamUrl) {
      fatalRetriesRef.current = 0;
      loadedUrlRef.current = streamUrl;
    }

    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    let silentCheckTimer: ReturnType<typeof setTimeout> | null = null;

    const clearSilentCheck = () => {
      if (silentCheckTimer !== null) {
        clearTimeout(silentCheckTimer);
        silentCheckTimer = null;
      }
    };

    const setReady = () => {
      setLoading(false);
      playback.syncFromVideo();
    };

    const applyAudioIssue = (message: string) => {
      setError(null);
      setAudioBanner(message);
      video.pause();
    };

    const applyAudioBlock = (blockReason: string, hls: Hls) => {
      playbackCtxRef.current = { browserAudio: false, manifestBlocked: true };
      setError(null);
      setAudioBanner(formatAudioErrorMessage(blockReason, audioTranscodeAvailable));
      setLoading(false);
      hls.destroy();
      hlsRef.current = null;
      setAudioOptions([]);
      setSubtitleOptions([]);
    };

    const scheduleSilentPlaybackCheck = () => {
      clearSilentCheck();
      silentCheckTimer = setTimeout(() => {
        if (playbackCtxRef.current.manifestBlocked) return;

        const issue = getPlaybackAudioIssue(
          video,
          playbackCtxRef.current.browserAudio,
        );
        if (issue) {
          applyAudioIssue(
            formatAudioErrorMessage(issue, audioTranscodeAvailable),
          );
        } else {
          setAudioBanner(null);
        }
      }, SILENT_CHECK_MS);
    };

    const onPlaying = () => {
      ensureVideoUnmuted(video);
      setReady();
      scheduleSilentPlaybackCheck();
    };
    const catchupPlayback = Boolean(streamUrl && isCatchupStreamUrl(streamUrl));

    const onVideoError = () => {
      clearSilentCheck();
      if (fatalRetriesRef.current < MAX_FATAL_RETRIES) {
        fatalRetriesRef.current += 1;
        setLoading(true);
        setError(null);
        const src = video.getAttribute('src') || streamUrl;
        video.removeAttribute('src');
        video.load();
        video.src = src;
        ensureVideoUnmuted(video);
        void video.play().catch(() => undefined);
        return;
      }
      const base = 'Nie udało się odtworzyć strumienia.';
      setError(
        catchupPlayback
          ? `${base}${CATCHUP_ERROR_HINT}`
          : `${base} Spróbuj ponownie lub wybierz inny kanał.`,
      );
      setLoading(false);
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onVideoError);

    const showPlaybackError = (details?: string) => {
      clearSilentCheck();
      if (isHlsAudioCodecError(details)) {
        setError(null);
        setAudioBanner(
          formatAudioErrorMessage(DOLBY_AUDIO_MESSAGE, audioTranscodeAvailable),
        );
      } else {
        const hint = catchupPlayback
          ? CATCHUP_ERROR_HINT
          : details === 'manifestLoadError' || details === 'networkError'
            ? ' Sprawdź połączenie lub spróbuj innego kanału.'
            : ' Spróbuj innego kanału lub aplikacji mobilnej.';
        setError(`Nie udało się odtworzyć strumienia.${hint}`);
        setAudioBanner(null);
      }
      setLoading(false);
    };

    const setupHlsVideoLevel = (hls: Hls) => {
      debugLogCodecs('levels', hls.levels);
      const levelIdx = pickLevelWithBrowserAudio(hls.levels);
      if (levelIdx !== null) {
        hls.currentLevel = levelIdx;
        hls.loadLevel = levelIdx;
      }
    };

    const evaluateAudioTracks = (hls: Hls): boolean => {
      const tracks = hls.audioTracks;
      const blockReason = getManifestAudioBlockReason(
        hls.levels,
        tracks.length > 0 ? tracks : undefined,
      );

      if (blockReason) {
        if (tracks.length === 0 && !levelOnlyAudioCheckedRef.current) {
          return true;
        }
        applyAudioBlock(blockReason, hls);
        return false;
      }

      if (!userPickedAudioRef.current) {
        applyBestAudioTrack(hls);
      }

      if (!userPickedSubtitleRef.current) {
        hls.subtitleTrack = -1;
        hls.subtitleDisplay = false;
      }

      playbackCtxRef.current = { browserAudio: true, manifestBlocked: false };
      syncTracksFromHls(hls);
      return true;
    };

    const onAudioTracksUpdated = (hls: Hls) => {
      if (!evaluateAudioTracks(hls)) return;
      setAudioBanner(null);
    };

    const onSubtitleTracksUpdated = (hls: Hls) => {
      setSubtitleOptions(buildSubtitleTrackOptions(hls.subtitleTracks));
      if (!userPickedSubtitleRef.current) {
        hls.subtitleTrack = -1;
        hls.subtitleDisplay = false;
        setSelectedSubtitleId(-1);
      } else {
        setSelectedSubtitleId(hls.subtitleTrack);
      }
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls(buildHlsConfig());
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setupHlsVideoLevel(hls);
        if (hls.audioTracks.length > 0) {
          if (!evaluateAudioTracks(hls)) return;
        }
        ensureVideoUnmuted(video);
        void video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        if (hls.audioTracks.length > 0) return;
        if (levelOnlyAudioCheckedRef.current) return;
        levelOnlyAudioCheckedRef.current = true;
        onAudioTracksUpdated(hls);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        onAudioTracksUpdated(hls);
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        onSubtitleTracksUpdated(hls);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (isHlsAudioCodecError(data.details)) {
          showPlaybackError(data.details);
          return;
        }
        if (fatalRetriesRef.current < MAX_FATAL_RETRIES) {
          fatalRetriesRef.current += 1;
          setLoading(true);
          setError(null);
          try {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
              return;
            }
          } catch {
            /* fall through to remount */
          }
          setReloadToken((t) => t + 1);
          return;
        }
        showPlaybackError(data.details);
      });

      return () => {
        clearSilentCheck();
        hls.destroy();
        hlsRef.current = null;
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onVideoError);
      };
    }

    if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      ensureVideoUnmuted(video);
      void video.play().catch(() => undefined);
      return () => {
        clearSilentCheck();
        video.pause();
        video.removeAttribute('src');
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('error', onVideoError);
      };
    }

    video.src = streamUrl;
    ensureVideoUnmuted(video);
    void video.play().catch(() => undefined);

    return () => {
      clearSilentCheck();
      video.pause();
      video.removeAttribute('src');
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onVideoError);
    };
  }, [streamUrl, reloadToken, audioTranscodeAvailable, playback.syncFromVideo, syncTracksFromHls]);

  return (
    <div
      className="video-player-wrap"
      ref={wrapRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onPointerDown={onPointerDown}
    >
      <div className="video-player-media">
        <video ref={videoRef} className="video-player" playsInline />
        {title && <div className="video-player-title">{title}</div>}
        {audioBanner && (
          <div className="player-audio-unavailable" role="status">
            {audioBanner}
          </div>
        )}
        {loading && (
          <div
            className="video-player-overlay video-player-overlay--loading"
            aria-busy="true"
            aria-label="Ładowanie kanału"
          />
        )}
      </div>

      {streamUrl && (
        <PlayerControls
          visible={controlsVisible}
          streamUrl={streamUrl}
          playback={playback}
          videoRef={videoRef}
          wrapRef={wrapRef}
          activeChannel={activeChannel}
          epgNow={epgNow}
          playingEpgListing={playingEpgListing}
          archivedListings={archivedListings}
          displayTimeZone={displayTimeZone}
          onStop={onStop}
          onGoLive={onGoLive}
          onPlayArchiveListing={onPlayArchiveListing}
          onPlayLive={onPlayLive}
          audioOptions={audioOptions}
          subtitleOptions={subtitleOptions}
          selectedAudioId={selectedAudioId}
          selectedSubtitleId={selectedSubtitleId}
          onAudioChange={handleAudioChange}
          onSubtitleChange={handleSubtitleChange}
        />
      )}

      {error && !audioBanner && (
        <div className="alert alert-warning m-2 mb-0 d-flex align-items-center justify-content-between gap-2" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-sm btn-outline-dark flex-shrink-0" onClick={retryPlayback}>
            Spróbuj ponownie
          </button>
        </div>
      )}
    </div>
  );
}
