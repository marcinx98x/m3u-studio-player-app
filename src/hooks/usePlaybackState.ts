import { useCallback, useEffect, useState, type RefObject } from 'react';
import { getBufferedEnd, getSeekableRange, isFiniteDuration } from '../utils/playback';

export interface PlaybackState {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  seekStart: number;
  seekEnd: number;
  paused: boolean;
  muted: boolean;
  volume: number;
}

const INITIAL: PlaybackState = {
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  seekStart: 0,
  seekEnd: 0,
  paused: true,
  muted: false,
  volume: 1,
};

export function usePlaybackState(
  videoRef: RefObject<HTMLVideoElement | null>,
  streamUrl: string | null,
) {
  const [state, setState] = useState<PlaybackState>(INITIAL);

  const syncFromVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const seekable = getSeekableRange(video);
    setState({
      currentTime: video.currentTime,
      duration: video.duration,
      bufferedEnd: getBufferedEnd(video),
      seekStart: seekable?.start ?? 0,
      seekEnd: seekable?.end ?? 0,
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
    });
  }, [videoRef]);

  useEffect(() => {
    if (!streamUrl) {
      setState(INITIAL);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => syncFromVideo();
    const onProgress = () => syncFromVideo();
    const onPlay = () => setState((s) => ({ ...s, paused: false }));
    const onPause = () => setState((s) => ({ ...s, paused: true }));
    const onVolumeChange = () =>
      setState((s) => ({
        ...s,
        muted: video.muted,
        volume: video.volume,
      }));
    const onLoadedMetadata = () => syncFromVideo();
    const onDurationChange = () => syncFromVideo();

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('durationchange', onDurationChange);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('durationchange', onDurationChange);
    };
  }, [streamUrl, videoRef, syncFromVideo]);

  const play = useCallback(() => {
    void videoRef.current?.play().catch(() => undefined);
  }, [videoRef]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [videoRef]);

  const seek = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const finite = isFiniteDuration(video.duration);
      const seekable = getSeekableRange(video);
      if (finite) {
        video.currentTime = value;
      } else if (seekable) {
        video.currentTime = seekable.start + value;
      }
      syncFromVideo();
    },
    [videoRef, syncFromVideo],
  );

  const setVolume = useCallback(
    (volume: number) => {
      const video = videoRef.current;
      if (!video) return;
      const clamped = Math.min(1, Math.max(0, volume));
      video.volume = clamped;
      if (clamped > 0 && video.muted) {
        video.muted = false;
      }
      syncFromVideo();
    },
    [videoRef, syncFromVideo],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    syncFromVideo();
  }, [videoRef, syncFromVideo]);

  return {
    ...state,
    syncFromVideo,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
  };
}
