import type { RefObject } from 'react';
import {
  computeProgressMetrics,
  isFiniteDuration,
  seekToProgressValue,
} from '../../utils/playback';

interface PlayerProgressBarProps {
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  seekStart: number;
  seekEnd: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSeeked: () => void;
  /** Ukryj pasek bufora (zastąpiony przez EPG na live). */
  hideBufferBar?: boolean;
}

export default function PlayerProgressBar({
  currentTime,
  duration,
  bufferedEnd,
  seekStart,
  seekEnd,
  videoRef,
  onSeeked,
  hideBufferBar = false,
}: PlayerProgressBarProps) {
  const metrics = computeProgressMetrics(
    currentTime,
    duration,
    bufferedEnd,
    seekStart,
    seekEnd,
  );

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video || !metrics.canSeek) return;
    seekToProgressValue(
      video,
      value,
      isFiniteDuration(duration),
      seekStart,
    );
    onSeeked();
  };

  return (
    <div
      className={`video-player-progress${metrics.isLiveMode && !metrics.canSeek ? ' video-player-progress--live' : ''}`}
    >
      <div className="video-player-progress-track-wrap">
        {!hideBufferBar && !metrics.canSeek && metrics.bufferPct > 0 && (
          <div
            className="video-player-progress-buffer"
            style={{ width: `${metrics.bufferPct}%` }}
          />
        )}
        <input
          type="range"
          className="video-player-progress-range"
          min={0}
          max={metrics.progressMax}
          step={0.1}
          value={Math.min(metrics.progressValue, metrics.progressMax)}
          disabled={!metrics.canSeek}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Postęp odtwarzania"
          aria-valuetext={metrics.timeLabel}
        />
      </div>
      <span className="video-player-progress-time">{metrics.timeLabel}</span>
    </div>
  );
}
