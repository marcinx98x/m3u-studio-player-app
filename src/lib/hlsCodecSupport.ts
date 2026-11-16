import type Hls from 'hls.js';
import type { Level, MediaPlaylist } from 'hls.js';

const DOLBY_AUDIO_CODECS = new Set(['ac-3', 'ec-3', 'eac-3', 'mp4a.a6', 'mp4a.a5']);

export const DOLBY_AUDIO_MESSAGE =
  'Ten kanał ma dźwięk Dolby (AC-3). W przeglądarce nie da się go odtworzyć — w TiviMate lub VLC działa normalnie. Maskowanie strumienia na to nie wpływa.';

export const SILENT_PLAYBACK_HINT =
  'Obraz jest, ale dźwięku nie widać w przeglądarce. Sprawdź głośność systemu i karty w Chrome (ikona głośnika na karcie).';

export const NO_ELEMENT_AUDIO_MESSAGE =
  'Głośnik jest wyszarzony, bo przeglądarka nie odtwarza dźwięku tego kanału (Dolby AC-3). W TiviMate lub VLC działa normalnie. Maskowanie strumienia na to nie wpływa.';

export function formatAudioErrorMessage(
  base: string,
  audioTranscodeAvailable = false,
): string {
  if (!audioTranscodeAvailable) return base;
  return `${base} (Na koncie włączone jest opcjonalne transkodowanie audio przez serwer — wymaga ffmpeg.)`;
}

export function parseCodecsList(codecs?: string | null): string[] {
  if (!codecs || codecs.trim() === '') return [];
  return codecs
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
}

export function parseCodecsFromLevel(level: Level | undefined): string[] {
  if (!level) return [];
  const fromAttr = parseCodecsList(level.attrs?.CODECS ?? level.codecs);
  const audio = level.audioCodec?.trim().toLowerCase();
  if (audio && !fromAttr.includes(audio)) {
    return [...fromAttr, audio];
  }
  return fromAttr;
}

export function isAacCodec(codec: string): boolean {
  const c = codec.toLowerCase();
  return c.includes('mp4a');
}

export function isDolbyOrUnsupportedAudioCodec(codec: string): boolean {
  const c = codec.toLowerCase();
  if (DOLBY_AUDIO_CODECS.has(c)) return true;
  if (c.startsWith('ac-3') || c.startsWith('ec-3') || c.startsWith('eac')) return true;
  return false;
}

export function isAudioCodecBrowserSupported(codec: string): boolean {
  const c = codec.trim().toLowerCase();
  if (!c) return true;
  if (isAacCodec(c)) {
    if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported) {
      return MediaSource.isTypeSupported(`audio/mp4; codecs="${c}"`);
    }
    return true;
  }
  if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported) {
    const mime = `audio/mp4; codecs="${c}"`;
    if (MediaSource.isTypeSupported(mime)) return true;
  }
  if (isDolbyOrUnsupportedAudioCodec(c)) return false;
  return true;
}

export function getUnsupportedAudioReason(codecs: string[]): string | null {
  const audioCodecs = codecs.filter(
    (c) =>
      !c.startsWith('avc') &&
      !c.startsWith('hvc') &&
      !c.startsWith('hev') &&
      !c.startsWith('av01') &&
      !c.startsWith('vp'),
  );
  if (audioCodecs.length === 0) return null;

  const unsupported = audioCodecs.filter((c) => !isAudioCodecBrowserSupported(c));
  if (unsupported.length === 0) return null;

  const onlyDolby = unsupported.every(isDolbyOrUnsupportedAudioCodec);
  if (onlyDolby) return DOLBY_AUDIO_MESSAGE;

  return `Ten kanał używa audio (${unsupported.join(', ')}), którego przeglądarka nie obsługuje. Użyj TiviMate lub VLC.`;
}

export function levelHasBrowserAudio(level: Level | undefined): boolean {
  return getUnsupportedAudioReason(parseCodecsFromLevel(level)) === null;
}

/** Highest HLS level whose audio codec works in this browser (often HD/AAC vs 4K/Dolby). */
export function pickLevelWithBrowserAudio(levels: Level[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < levels.length; i++) {
    if (!levelHasBrowserAudio(levels[i])) continue;
    const h = levels[i].height ?? 0;
    if (best === null || h > (levels[best].height ?? 0)) {
      best = i;
    }
  }
  return best;
}

export function audioTrackCodecs(track: MediaPlaylist): string[] {
  const fromAttr = parseCodecsList(track.attrs?.CODECS ?? null);
  const audio = track.audioCodec?.trim().toLowerCase();
  if (audio && !fromAttr.includes(audio)) {
    return [...fromAttr, audio];
  }
  if (fromAttr.length > 0) return fromAttr;
  const name = (track.name || '').toLowerCase();
  if (name.includes('ac-3') || name.includes('ec-3') || name.includes('eac3')) {
    return ['ac-3'];
  }
  if (name.includes('5.1') || name.includes('5_1')) {
    return ['ac-3'];
  }
  return fromAttr;
}

export function audioTrackIsBrowserPlayable(track: MediaPlaylist): boolean {
  const codecs = audioTrackCodecs(track);
  if (codecs.length === 0) return true;
  return codecs.every((c) => isAudioCodecBrowserSupported(c));
}

export function hasPlayableAudioTrack(tracks: MediaPlaylist[]): boolean {
  return tracks.some(audioTrackIsBrowserPlayable);
}

export function getManifestAudioBlockReason(
  levels: Level[],
  audioTracks?: MediaPlaylist[],
): string | null {
  if (audioTracks && audioTracks.length > 0) {
    if (hasPlayableAudioTrack(audioTracks)) return null;
    const merged = audioTracks.flatMap((t) => audioTrackCodecs(t));
    return getUnsupportedAudioReason(merged) ?? DOLBY_AUDIO_MESSAGE;
  }

  if (levels.length === 0) return null;
  if (pickLevelWithBrowserAudio(levels) !== null) return null;
  const merged = levels.flatMap((l) => parseCodecsFromLevel(l));
  return getUnsupportedAudioReason(merged) ?? DOLBY_AUDIO_MESSAGE;
}

export function isAacAudioTrack(track: MediaPlaylist): boolean {
  const codecs = audioTrackCodecs(track);
  if (codecs.some(isAacCodec)) return true;
  const fallback = (track.audioCodec || track.attrs?.CODECS || track.name || '').toLowerCase();
  return fallback.includes('mp4a');
}

export function formatAudioTrackLabel(track: MediaPlaylist): string {
  const name = track.name?.trim() || track.lang?.trim() || `Ścieżka ${track.id + 1}`;
  const codecs = audioTrackCodecs(track);
  const playable = audioTrackIsBrowserPlayable(track);

  if (isAacAudioTrack(track)) {
    return `${name} (AAC)`;
  }
  const isDolby = codecs.some(isDolbyOrUnsupportedAudioCodec);
  if (isDolby || /5\.1|5_1/i.test(track.name || '')) {
    return playable
      ? `${name} (5.1)`
      : `${name} (5.1, niedostępne w przeglądarce)`;
  }
  if (!playable && codecs.length > 0) {
    return `${name} (niedostępne w przeglądarce)`;
  }
  return name;
}

export function formatSubtitleTrackLabel(track: MediaPlaylist): string {
  const name = track.name?.trim();
  const lang = track.lang?.trim();
  if (name && lang && name !== lang) return `${name} (${lang})`;
  return name || lang || `Napisy ${track.id + 1}`;
}

export function pickBestAudioTrackId(tracks: MediaPlaylist[]): number | null {
  if (tracks.length === 0) return null;
  const aacPlayable = tracks.find(
    (t) => audioTrackIsBrowserPlayable(t) && isAacAudioTrack(t),
  );
  if (aacPlayable) return aacPlayable.id;
  const playable = tracks.find(audioTrackIsBrowserPlayable);
  if (playable) return playable.id;
  return null;
}

export interface AudioTrackOption {
  id: number;
  label: string;
  playable: boolean;
}

export interface SubtitleTrackOption {
  id: number;
  label: string;
}

export function buildAudioTrackOptions(tracks: MediaPlaylist[]): AudioTrackOption[] {
  return tracks.map((track) => ({
    id: track.id,
    label: formatAudioTrackLabel(track),
    playable: audioTrackIsBrowserPlayable(track),
  }));
}

export function buildSubtitleTrackOptions(tracks: MediaPlaylist[]): SubtitleTrackOption[] {
  return tracks.map((track) => ({
    id: track.id,
    label: formatSubtitleTrackLabel(track),
  }));
}

export function applyBestAudioTrack(hls: Hls): void {
  const bestId = pickBestAudioTrackId(hls.audioTracks);
  if (bestId !== null && hls.audioTrack !== bestId) {
    hls.audioTrack = bestId;
  }
}

/** @deprecated Use applyBestAudioTrack */
export function preferAacAudioTrack(hls: Hls): void {
  applyBestAudioTrack(hls);
}

export function isHlsAudioCodecError(details?: string): boolean {
  if (!details) return false;
  return (
    details === 'bufferAddCodecError' ||
    details === 'bufferIncompatibleCodecsError' ||
    details === 'fragParsingError'
  );
}

export function ensureVideoUnmuted(video: HTMLVideoElement): void {
  video.muted = false;
  if (video.volume === 0) {
    video.volume = 1;
  }
}

type VideoWithAudioMetrics = HTMLVideoElement & {
  webkitAudioDecodedByteCount?: number;
  mozHasAudio?: boolean;
};

/** Chrome exposes AudioTrackList when MSE attached an audio buffer. */
export function videoElementHasAudioTrack(video: HTMLVideoElement): boolean {
  try {
    const tracks = (video as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks;
    if (tracks && tracks.length > 0) {
      return true;
    }
  } catch {
    /* ignore */
  }

  const v = video as VideoWithAudioMetrics;
  if (typeof v.webkitAudioDecodedByteCount === 'number' && v.webkitAudioDecodedByteCount > 0) {
    return true;
  }
  if (typeof v.mozHasAudio === 'boolean' && v.mozHasAudio) {
    return true;
  }
  return false;
}

/** Heuristic: playback runs but browser decoded no audio samples. */
export function appearsToHaveNoDecodedAudio(video: HTMLVideoElement): boolean {
  if (video.muted || video.volume === 0) return false;
  if (video.paused || video.currentTime < 1) return false;

  if (videoElementHasAudioTrack(video)) {
    return false;
  }

  const v = video as VideoWithAudioMetrics;
  if (typeof v.webkitAudioDecodedByteCount === 'number') {
    return v.webkitAudioDecodedByteCount === 0;
  }
  if (typeof v.mozHasAudio === 'boolean') {
    return !v.mozHasAudio;
  }
  return true;
}

/**
 * Message after playback started — distinguishes Dolby (gray speaker) vs system volume.
 */
export function getPlaybackAudioIssue(
  video: HTMLVideoElement,
  browserAudioExpected: boolean,
): string | null {
  if (video.paused || video.currentTime < 1) return null;

  if (!browserAudioExpected) {
    return NO_ELEMENT_AUDIO_MESSAGE;
  }

  if (!videoElementHasAudioTrack(video)) {
    return NO_ELEMENT_AUDIO_MESSAGE;
  }

  ensureVideoUnmuted(video);
  if (appearsToHaveNoDecodedAudio(video)) {
    return SILENT_PLAYBACK_HINT;
  }

  return null;
}

export function debugLogCodecs(label: string, levels: Level[]): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('debugCodecs') !== '1') return;
  console.info(
    `[hls-codecs] ${label}`,
    levels.map((l, i) => ({
      index: i,
      height: l.height,
      codecs: l.codecs,
      audioCodec: l.audioCodec,
      browserOk: levelHasBrowserAudio(l),
    })),
  );
}
