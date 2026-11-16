/** Format seconds as m:ss or h:mm:ss for the player progress label. */
export function formatPlaybackClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function getBufferedEnd(video: HTMLVideoElement): number {
  const ranges = video.buffered;
  if (ranges.length === 0) return 0;
  return ranges.end(ranges.length - 1);
}

export function getSeekableRange(
  video: HTMLVideoElement,
): { start: number; end: number } | null {
  const ranges = video.seekable;
  if (ranges.length === 0) return null;
  const start = ranges.start(0);
  const end = ranges.end(ranges.length - 1);
  if (end > start) return { start, end };
  return null;
}

export function isFiniteDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

export interface ProgressMetrics {
  progressMax: number;
  progressValue: number;
  canSeek: boolean;
  isLiveMode: boolean;
  bufferPct: number;
  timeLabel: string;
}

export function computeProgressMetrics(
  currentTime: number,
  duration: number,
  bufferedEnd: number,
  seekStart: number,
  seekEnd: number,
): ProgressMetrics {
  const finiteDuration = isFiniteDuration(duration);
  const seekableWindow = seekEnd > seekStart;
  const progressMax = finiteDuration
    ? duration
    : seekableWindow
      ? seekEnd - seekStart
      : Math.max(bufferedEnd, 1);
  const progressValue = finiteDuration
    ? currentTime
    : seekableWindow
      ? Math.max(0, currentTime - seekStart)
      : bufferedEnd > 0
        ? Math.min(bufferedEnd, progressMax)
        : 0;
  const canSeek = finiteDuration || seekableWindow;
  const isLiveMode = !finiteDuration;
  const bufferPct =
    progressMax > 0 ? Math.min(100, (bufferedEnd / progressMax) * 100) : 0;

  const timeLabel = finiteDuration
    ? `${formatPlaybackClock(currentTime)} / ${formatPlaybackClock(duration)}`
    : seekableWindow
      ? `${formatPlaybackClock(currentTime - seekStart)} / ${formatPlaybackClock(seekEnd - seekStart)}`
      : 'NA ŻYWO';

  return {
    progressMax,
    progressValue,
    canSeek,
    isLiveMode,
    bufferPct,
    timeLabel,
  };
}

export function seekToProgressValue(
  video: HTMLVideoElement,
  value: number,
  finiteDuration: boolean,
  seekStart: number,
): void {
  if (finiteDuration) {
    video.currentTime = value;
  } else {
    video.currentTime = seekStart + value;
  }
}

const LIVE_PROGRAM_SEEK_MARGIN_SEC = 2;

/**
 * Przewija live HLS do momentu audycji (targetMs) w obrębie bufora seekable.
 * @returns true gdy ustawiono currentTime
 */
export function seekLiveToProgramTime(
  video: HTMLVideoElement,
  targetMs: number,
  nowMs = Date.now(),
): boolean {
  const seekable = getSeekableRange(video);
  if (!seekable) return false;

  const secsBehindLive = (nowMs - targetMs) / 1000;
  if (secsBehindLive < 0) return false;

  const targetTime = seekable.end - secsBehindLive;
  if (targetTime < seekable.start - LIVE_PROGRAM_SEEK_MARGIN_SEC) {
    return false;
  }

  video.currentTime = Math.max(seekable.start, targetTime);
  return true;
}

/** Czy targetMs jest poza oknem timeshift (wymaga archiwum catch-up). */
export function isLiveProgramSeekBeyondBuffer(
  video: HTMLVideoElement,
  targetMs: number,
  nowMs = Date.now(),
): boolean {
  const seekable = getSeekableRange(video);
  if (!seekable) return true;

  const secsBehindLive = (nowMs - targetMs) / 1000;
  if (secsBehindLive <= 0) return false;

  const bufferSpan = seekable.end - seekable.start;
  return secsBehindLive > bufferSpan + LIVE_PROGRAM_SEEK_MARGIN_SEC;
}
