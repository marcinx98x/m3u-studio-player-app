import type { XtreamEpgListing } from '../types/xtream';

/** Ile wpisów pobrać z get_short_epg, żeby wybrać bieżący program (lista jest ASC). */
/** Bieżący + do 3 następnych (API zwraca teraz + kolejne). */
export const SHORT_EPG_FETCH_LIMIT = 4;

function looksLikeBase64(value: string): boolean {
  const s = value.replace(/\s/g, '');
  if (s.length < 4 || s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(s);
}

/** Dekoduje pole EPG (tytuł / opis) — Xtream i API studio zwracają UTF-8 w base64. */
export function decodeEpgTitle(title: string): string {
  if (!title) return '';
  if (!looksLikeBase64(title)) return title;

  try {
    const binary = atob(title.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim();
    if (decoded) return decoded;
  } catch {
    /* not base64 */
  }

  return title;
}
export function epgStartMs(listing: { start?: string; start_timestamp?: string }): number {
  if (listing.start_timestamp) {
    const n = Number(listing.start_timestamp);
    if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
  }
  if (listing.start) {
    const d = new Date(listing.start.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

export function epgEndMs(listing: { end?: string; stop_timestamp?: string }): number {
  if (listing.stop_timestamp) {
    const n = Number(listing.stop_timestamp);
    if (!Number.isNaN(n)) return n < 1e12 ? n * 1000 : n;
  }
  if (listing.end) {
    const d = new Date(listing.end.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

const DEFAULT_EPG_TIMEZONE = 'Europe/Warsaw';

/** Strefa z server_info.timezone (zgodna z przesunięciem PL/UK z API). */
export function resolveEpgDisplayTimezone(serverTimezone?: string | null): string {
  const tz = serverTimezone?.trim();
  if (!tz) return DEFAULT_EPG_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_EPG_TIMEZONE;
  }
}

export function formatTime(ms: number, timeZone?: string): string {
  if (!ms) return '—';
  const tz = resolveEpgDisplayTimezone(timeZone);
  return new Date(ms).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}

export type EpgAirState = 'past' | 'live' | 'upcoming';

/** Stan audycji względem „teraz” — do podświetlenia wiersza w siatce EPG. */
export function epgListingAirState(
  listing: XtreamEpgListing,
  nowMs = Date.now(),
): EpgAirState {
  if (listing.now_playing === 1) return 'live';

  const start = epgStartMs(listing);
  const end = epgEndMs(listing);
  if (end > 0 && end <= nowMs) return 'past';
  if (start > 0 && end > 0 && nowMs >= start && nowMs < end) return 'live';

  return 'upcoming';
}

/** Pierwsza audycja trwająca teraz (do znacznika na torze przewijania). */
export function findLiveEpgListing(
  listings: XtreamEpgListing[],
  nowMs = Date.now(),
): XtreamEpgListing | null {
  return listings.find((l) => epgListingAirState(l, nowMs) === 'live') ?? null;
}

/** Czas trwania audycji w ms (0 gdy brak danych). */
export function epgProgramDurationMs(
  listing: { start?: string; start_timestamp?: string; end?: string; stop_timestamp?: string },
): number {
  const start = epgStartMs(listing);
  const end = epgEndMs(listing);
  if (start <= 0 || end <= start) return 0;
  return end - start;
}

/** Pozycja na osi audycji (ms) dla ułamka 0–1. */
export function epgTargetMsFromFraction(
  listing: { start?: string; start_timestamp?: string; end?: string; stop_timestamp?: string },
  fraction: number,
): number {
  const start = epgStartMs(listing);
  const duration = epgProgramDurationMs(listing);
  if (duration <= 0) return start;
  const f = Math.min(1, Math.max(0, fraction));
  return start + f * duration;
}

/** Ułamek 0–1 dla offsetu od początku audycji (ms). */
export function epgFractionFromOffsetMs(
  listing: { start?: string; start_timestamp?: string; end?: string; stop_timestamp?: string },
  offsetMs: number,
): number {
  const duration = epgProgramDurationMs(listing);
  if (duration <= 0) return 0;
  return Math.min(1, Math.max(0, offsetMs / duration));
}

/** Ułamek postępu bieżącej audycji 0–1, lub null gdy nie trwa. */
export function epgLiveProgressFraction(
  listing: XtreamEpgListing,
  nowMs = Date.now(),
): number | null {
  if (epgListingAirState(listing, nowMs) !== 'live') return null;

  const start = epgStartMs(listing);
  const end = epgEndMs(listing);
  if (start <= 0 || end <= start) return null;

  const progress = (nowMs - start) / (end - start);
  return Math.min(1, Math.max(0, progress));
}

/** Klucz dnia (YYYY-MM-DD) w strefie wyświetlania EPG. */
export function epgDayKey(ms: number, timeZone?: string): string {
  const tz = resolveEpgDisplayTimezone(timeZone);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(new Date(ms));
}

/** Nagłówek grupy: dzień tygodnia + data (np. poniedziałek, 26 maja 2026). */
export function epgDayGroupLabel(dayKey: string, timeZone?: string): string {
  const parts = dayKey.split('-').map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dayKey;
  }
  const [y, m, d] = parts;
  const tz = resolveEpgDisplayTimezone(timeZone);
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  return new Date(noonUtc).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: tz,
  });
}

/** Ile dni historii EPG pokazać w siatce (wstecz od „teraz”). */
export const EPG_GRID_PAST_DAYS = 10;

/** Usuwa identyczne wpisy (ten sam start, koniec, tytuł) — duplikaty z wielokrotnego importu EPG w bazie. */
export function dedupeEpgListings(listings: XtreamEpgListing[]): XtreamEpgListing[] {
  const seen = new Set<string>();
  const out: XtreamEpgListing[] = [];
  for (const item of listings) {
    const key = `${epgStartMs(item)}\0${epgEndMs(item)}\0${item.title ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Zostawia bieżące i przyszłe programy; w przeszłości tylko zakres `pastDays`. */
export function trimPastEpgListings(
  listings: XtreamEpgListing[],
  nowMs = Date.now(),
  pastDays = EPG_GRID_PAST_DAYS,
): XtreamEpgListing[] {
  if (pastDays <= 0) {
    return listings
      .filter((item) => epgListingAirState(item, nowMs) !== 'past')
      .sort((a, b) => epgStartMs(a) - epgStartMs(b));
  }
  const cutoffMs = nowMs - pastDays * 24 * 60 * 60 * 1000;
  return listings
    .filter((item) => {
      if (epgListingAirState(item, nowMs) !== 'past') return true;
      return epgEndMs(item) >= cutoffMs;
    })
    .sort((a, b) => epgStartMs(a) - epgStartMs(b));
}

export interface EpgDayGroup {
  dayKey: string;
  label: string;
  items: XtreamEpgListing[];
}

/** Grupuje programy wg dnia rozpoczęcia (kolejność chronologiczna dni i audycji). */
export function groupEpgListingsByDay(
  listings: XtreamEpgListing[],
  timeZone?: string,
): EpgDayGroup[] {
  const buckets = new Map<string, XtreamEpgListing[]>();
  const unknown: XtreamEpgListing[] = [];

  for (const item of listings) {
    const startMs = epgStartMs(item);
    if (startMs <= 0) {
      unknown.push(item);
      continue;
    }
    const key = epgDayKey(startMs, timeZone);
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const groups: EpgDayGroup[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, items]) => ({
      dayKey,
      label: epgDayGroupLabel(dayKey, timeZone),
      items: items.sort((a, b) => epgStartMs(a) - epgStartMs(b)),
    }));

  if (unknown.length > 0) {
    groups.push({ dayKey: '', label: 'Inne', items: unknown });
  }

  return groups;
}

/** Bieżący program — preferuj now_playing, potem przedział czasowy. */
export function pickCurrentEpgListing(listings: XtreamEpgListing[]): XtreamEpgListing | null {
  if (listings.length === 0) return null;

  const flagged = listings.find((l) => l.now_playing === 1);
  if (flagged) return flagged;

  const nowMs = Date.now();
  const byTime = listings.find((l) => {
    const start = epgStartMs(l);
    const end = epgEndMs(l);
    return start > 0 && end > 0 && nowMs >= start && nowMs < end;
  });
  if (byTime) return byTime;

  const airing = listings.filter((l) => {
    const start = epgStartMs(l);
    const end = epgEndMs(l);
    return start > 0 && end > 0 && nowMs >= start && nowMs < end;
  });
  if (airing.length > 0) {
    return airing.reduce((best, l) =>
      epgStartMs(l) > epgStartMs(best) ? l : best,
    );
  }

  return null;
}

/** Następny program po bieżącym (wg start_time). */
export function pickNextEpgListing(
  listings: XtreamEpgListing[],
  current: XtreamEpgListing | null,
): XtreamEpgListing | null {
  const afterMs = current ? epgEndMs(current) : Date.now();
  let best: XtreamEpgListing | null = null;
  let bestStart = Infinity;

  for (const l of listings) {
    const start = epgStartMs(l);
    if (start <= 0 || start < afterMs) continue;
    if (current && l.id && current.id && l.id === current.id) continue;
    if (start < bestStart) {
      best = l;
      bestStart = start;
    }
  }

  return best;
}