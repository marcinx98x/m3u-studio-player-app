const MEDIA_PATH_RE = /^\/(live|movie|series|timeshift)(\/|$)/i;

/**
 * True when URL is allowed for playback:
 * - under configured Xtream API base (/api/xtream/…), or
 * - same-origin studio root media paths (/live|/movie|/series|/timeshift).
 */
export function isAllowedStreamUrl(url: string, xtreamBase: string): boolean {
  const base = xtreamBase.replace(/\/$/, '');
  if (!base || !url) return false;
  try {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(url, origin);
    const b = new URL(base, origin);
    const basePath = b.pathname.replace(/\/$/, '') || '/';

    if (u.origin !== b.origin) {
      // Absolute media on studio host when API base is absolute and media base differs only by path
      const studio = new URL(base.replace(/\/api\/xtream\/?$/, '') || base);
      if (u.origin === studio.origin && MEDIA_PATH_RE.test(u.pathname)) {
        return true;
      }
      return false;
    }

    if (u.pathname === basePath || u.pathname.startsWith(`${basePath}/`)) {
      return true;
    }

    return MEDIA_PATH_RE.test(u.pathname);
  } catch {
    return url.startsWith(base) || MEDIA_PATH_RE.test(url);
  }
}
