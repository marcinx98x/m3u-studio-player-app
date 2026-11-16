/**
 * Bazowy URL Xtream API (bez końcowego slasha).
 * Dev: zawsze ścieżka względna → Vite proxy /api (unika CORS).
 */
export function getXtreamBase(): string {
  if (import.meta.env.DEV) {
    return '/api/xtream';
  }
  const configured = (import.meta.env.VITE_XTREAM_SERVER || '').trim();
  if (!configured) {
    return 'https://m3u-studio.marcincloud.org/api/xtream';
  }
  return configured.replace(/\/$/, '');
}

/**
 * Baza URL dla strumieni live/movie/series/timeshift (bez końcowego slasha).
 * Na IONOS rewrite pod /api/xtream/live/… nie działa — używamy root /live/… (public/.htaccess).
 * Dev: '' → ścieżki względne /live/… (Vite proxy).
 */
export function getStreamMediaBase(): string {
  if (import.meta.env.DEV) {
    return '';
  }
  const apiBase = getXtreamBase();
  return apiBase.replace(/\/api\/xtream\/?$/, '');
}

export const APP_TITLE = 'M3U Studio Player';
