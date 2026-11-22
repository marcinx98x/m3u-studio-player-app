import { getStreamMediaBase, getXtreamBase } from '../config/env';
import type {
  XtreamAuthResponse,
  XtreamCategory,
  XtreamEpgApiResponse,
  XtreamEpgListing,
  XtreamLiveStream,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamUserInfo,
  XtreamVodStream,
} from '../types/xtream';
import { epgEndMs, epgStartMs } from '../utils/epg';

export class XtreamApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'XtreamApiError';
    this.statusCode = statusCode;
  }
}

/** Network / abort / 5xx / 429 — keep stored player session (e.g. Ctrl+F5). */
export function isXtreamSoftFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (!(err instanceof XtreamApiError)) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    return msg.includes('failed to fetch') || msg.includes('network');
  }
  const status = err.statusCode;
  if (status != null && (status >= 500 || status === 429)) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('brak połączenia') ||
    msg.includes('failed to fetch') ||
    msg.includes('błąd proxy') ||
    msg.includes('network')
  );
}

export interface XtreamCredentials {
  username: string;
  /** Opaque session from player_api — preferred for API + stream URLs */
  sessionToken?: string;
  /** Only for initial login; never stored after session mint */
  password?: string;
}

const ALLOWED_CONTAINER_EXT = new Set([
  'm3u8',
  'ts',
  'mp4',
  'mkv',
  'avi',
  'mov',
  'mpg',
  'mpeg',
  'flv',
  'webm',
]);

/** Sanitize container_extension from catalog (path injection defense). */
export function sanitizeContainerExtension(
  raw: string | undefined | null,
  fallback: string,
): string {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/g, '');
  if (cleaned && ALLOWED_CONTAINER_EXT.has(cleaned)) {
    return cleaned;
  }
  return fallback;
}

/** Safe URL for <img src> — https or same-origin relative only. */
export function sanitizeStreamIconUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:') return u.href;
    return null;
  } catch {
    return null;
  }
}

function playerApiUrl(creds: XtreamCredentials, extra?: Record<string, string>): string {
  const base = getXtreamBase();
  const params = new URLSearchParams({ ...extra });
  if (creds.sessionToken) {
    params.set('session', creds.sessionToken);
  } else {
    params.set('username', creds.username);
    params.set('password', creds.password ?? '');
  }
  return `${base}/player_api.php?${params.toString()}`;
}

async function xtreamFetch<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    const hint = import.meta.env.DEV
      ? ' Uruchom `npm run dev` na porcie 5174 — żądania idą przez proxy /api.'
      : ' Na produkcji dodaj origin playera do IPTV_CORS_ORIGINS lub skonfiguruj reverse proxy /api na subdomenie playera.';
    throw new XtreamApiError(`Brak połączenia z serwerem Xtream.${hint}`);
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new XtreamApiError('Osiągnięto limit jednoczesnych połączeń (max_connections).', 429);
    }
    if (res.status === 500) {
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        throw new XtreamApiError(
          'Błąd proxy API na subdomenie playera (500). Odśwież stronę po deployu lub skonfiguruj ProxyPass /api/ w Apache.',
          500,
        );
      }
    }
    throw new XtreamApiError(`Błąd serwera (${res.status})`, res.status);
  }
  const text = await res.text();
  if (!text.trim()) {
    throw new XtreamApiError('Pusta odpowiedź serwera');
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new XtreamApiError('Nieprawidłowa odpowiedź JSON z API');
  }
  return data as T;
}

export function isAuthOk(userInfo?: XtreamUserInfo): boolean {
  if (!userInfo) return false;
  if (userInfo.auth === 0) return false;
  const status = (userInfo.status || '').toLowerCase();
  if (status === 'banned' || status === 'disabled' || status === 'expired') return false;
  return userInfo.auth === 1 || status === 'active' || status === '';
}

export function authErrorMessage(userInfo?: XtreamUserInfo): string {
  if (!userInfo) return 'Brak danych użytkownika z API';
  if (userInfo.message?.trim()) return userInfo.message.trim();
  const status = userInfo.status || 'Unknown';
  return `Logowanie nieudane (status: ${status})`;
}

export type XtreamAuthWithSession = XtreamAuthResponse & { player_session?: string };

export async function xtreamLogin(creds: XtreamCredentials): Promise<XtreamAuthWithSession> {
  const data = await xtreamFetch<XtreamAuthWithSession>(playerApiUrl(creds));
  if (!isAuthOk(data.user_info)) {
    throw new XtreamApiError(authErrorMessage(data.user_info));
  }
  return data;
}

export async function xtreamLogout(creds: XtreamCredentials): Promise<void> {
  if (!creds.sessionToken) return;
  try {
    await xtreamFetch<{ success?: boolean }>(
      playerApiUrl(creds, { action: 'logout' }),
    );
  } catch {
    /* best-effort */
  }
}

export async function xtreamAction<T>(
  creds: XtreamCredentials,
  action: string,
  extra?: Record<string, string>,
): Promise<T> {
  const url = playerApiUrl(creds, { action, ...extra });
  return xtreamFetch<T>(url);
}

export async function getLiveCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await xtreamAction<XtreamCategory[]>(creds, 'get_live_categories');
  return Array.isArray(data) ? data : [];
}

export async function getLiveStreams(creds: XtreamCredentials): Promise<XtreamLiveStream[]> {
  const data = await xtreamAction<XtreamLiveStream[]>(creds, 'get_live_streams');
  return Array.isArray(data) ? data : [];
}

export interface XtreamLiveCatalogResponse {
  categories: XtreamCategory[];
  streams: XtreamLiveStream[];
}

/** Jedno żądanie: kategorie + kanały live (szybsze niż dwa osobne get_live_*). */
export async function getLiveCatalog(creds: XtreamCredentials): Promise<XtreamLiveCatalogResponse> {
  const data = await xtreamAction<XtreamLiveCatalogResponse>(creds, 'get_live_catalog');
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    streams: Array.isArray(data?.streams) ? data.streams : [],
  };
}

export async function getShortEpg(
  creds: XtreamCredentials,
  streamId: number,
  limit = 4,
): Promise<XtreamEpgApiResponse> {
  return xtreamAction<XtreamEpgApiResponse>(creds, 'get_short_epg', {
    stream_id: String(streamId),
    limit: String(limit),
  });
}

export async function getSimpleDataTable(
  creds: XtreamCredentials,
  streamId: number,
): Promise<XtreamEpgApiResponse> {
  return xtreamAction<XtreamEpgApiResponse>(creds, 'get_simple_data_table', {
    stream_id: String(streamId),
  });
}

export async function getVodCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await xtreamAction<XtreamCategory[]>(creds, 'get_vod_categories');
  return Array.isArray(data) ? data : [];
}

export async function getVodStreams(creds: XtreamCredentials): Promise<XtreamVodStream[]> {
  const data = await xtreamAction<XtreamVodStream[]>(creds, 'get_vod_streams');
  return Array.isArray(data) ? data : [];
}

export async function getSeriesCategories(creds: XtreamCredentials): Promise<XtreamCategory[]> {
  const data = await xtreamAction<XtreamCategory[]>(creds, 'get_series_categories');
  return Array.isArray(data) ? data : [];
}

export async function getSeries(creds: XtreamCredentials): Promise<XtreamSeries[]> {
  const data = await xtreamAction<XtreamSeries[]>(creds, 'get_series');
  return Array.isArray(data) ? data : [];
}

export async function getSeriesInfo(
  creds: XtreamCredentials,
  seriesId: number,
): Promise<XtreamSeriesInfo> {
  return xtreamAction(creds, 'get_series_info', { series_id: String(seriesId) });
}

export type StreamKind = 'live' | 'movie' | 'series';

function streamExtension(preferHls: boolean): string {
  return preferHls ? 'm3u8' : 'ts';
}

function streamAuthSegment(creds: XtreamCredentials): { mode: 'session' | 'legacy'; path: string } {
  if (creds.sessionToken) {
    return { mode: 'session', path: `s/${encodeURIComponent(creds.sessionToken)}` };
  }
  const user = encodeURIComponent(creds.username);
  const pass = encodeURIComponent(creds.password ?? '');
  return { mode: 'legacy', path: `${user}/${pass}` };
}

/** URL odtwarzania live / vod / odcinka serialu. */
export function buildStreamUrl(
  creds: XtreamCredentials,
  kind: StreamKind,
  streamId: number | string,
  containerExtension?: string,
): string {
  const base = getStreamMediaBase();
  const auth = streamAuthSegment(creds);
  const id = encodeURIComponent(String(streamId));

  if (kind === 'movie') {
    const ext = sanitizeContainerExtension(containerExtension, 'mp4');
    return `${base}/movie/${auth.path}/${id}.${ext}`;
  }
  if (kind === 'series') {
    const ext = sanitizeContainerExtension(containerExtension, 'mp4');
    return `${base}/series/${auth.path}/${id}.${ext}`;
  }

  const ext = sanitizeContainerExtension(containerExtension, streamExtension(true));
  return `${base}/live/${auth.path}/${id}.${ext}`;
}

/** Catchup / timeshift — standardowy format Xtream (utc + lutc + opcjonalnie start/end). */
export function buildCatchupUrl(
  creds: XtreamCredentials,
  streamId: number,
  startUtc: number,
  durationMinutes: number,
  endUtc?: number,
): string {
  const base = getStreamMediaBase();
  const auth = streamAuthSegment(creds);
  const id = encodeURIComponent(String(streamId));
  const now = Math.floor(Date.now() / 1000);
  const durationSec =
    endUtc !== undefined && endUtc > startUtc
      ? Math.max(60, endUtc - startUtc)
      : Math.max(60, durationMinutes * 60);

  const params = new URLSearchParams({
    utc: String(startUtc),
    lutc: String(now),
    duration: String(durationSec),
    start: String(startUtc),
  });
  if (endUtc !== undefined && endUtc > startUtc) {
    params.set('end', String(endUtc));
  }

  return `${base}/live/${auth.path}/${id}.m3u8?${params.toString()}`;
}

/** URL archiwum z wpisu EPG (start/end z programu). */
export function buildCatchupUrlFromListing(
  creds: XtreamCredentials,
  streamId: number,
  listing: XtreamEpgListing,
): string {
  const startMs = epgStartMs(listing);
  const endMs = epgEndMs(listing);
  const startUtc = Math.floor(startMs / 1000);
  const endUtc = endMs > startMs ? Math.floor(endMs / 1000) : undefined;
  const durationMin =
    startMs && endMs
      ? Math.max(1, Math.round((endMs - startMs) / 60000))
      : 60;
  return buildCatchupUrl(creds, streamId, startUtc, durationMin, endUtc);
}

export function isCatchupStreamUrl(url: string): boolean {
  return /[?&]utc=/i.test(url);
}

export function isLiveStreamUrl(url: string): boolean {
  return /\/live\//i.test(url) && !isCatchupStreamUrl(url);
}

export function channelHasArchive(ch: XtreamLiveStream): boolean {
  return (
    ch.tv_archive === 1 ||
    (typeof ch.tv_archive_duration === 'number' && ch.tv_archive_duration > 0)
  );
}