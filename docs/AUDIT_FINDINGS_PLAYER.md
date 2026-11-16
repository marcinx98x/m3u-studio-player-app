# Audyt M3U Studio Player — stan po naprawie

Aktualizacja: 2026-11-02 (Faza 1 + Faza 2 tokenizacja).

| Status | Znaczenie |
|--------|-----------|
| **JEST** | Funkcja / ochrona obecna |
| **BRAK** | Nie zaimplementowano |
| **RYZYKO** | Częściowo / wymaga deploy |

## Bezpieczeństwo

| Pozycja | Status |
|---------|--------|
| Hasło w path/query streamów (web player) | JEST naprawione — `/live/s/{session}/…` |
| Opaque `player_session` z `player_api.php` | JEST |
| Hasło w `sessionStorage` | JEST usunięte (tylko username + session) |
| VOD 302 z Refererem credentials | JEST — session → proxy `stream.php?movie_id` / `episode_id` |
| Same-origin HLS rewrite przy session | JEST (`browserProxy \|\| session`) |
| CSP / Referrer-Policy / frame-ancestors | JEST (htaccess example + meta referrer) |
| Allowlista `container_extension` | JEST |
| Allowlista `stream_icon` (https) | JEST |
| Allowlista origin stream URL w playerze | JEST |
| Prod sourcemaps | JEST wyłączone |
| Legacy Xtream `/user/pass/` (native) | JEST zachowane |

## Reliability / UX

| Pozycja | Status |
|---------|--------|
| HLS fatal recover + Retry | JEST |
| Live catalog fallback get_live_* | JEST |
| VOD / series fetch | JEST |
| Short EPG refresh | JEST |
| Favorites reload on username | JEST |

## Testy

| Suite | Status |
|-------|--------|
| Vitest (URL sanitize, EPG, codecs, allowlist) | JEST |

Deploy: wgraj zaktualizowane `api/xtream/*` ze studia **oraz** nowy build playera. CORS: origin playera w `IPTV_CORS_ORIGINS`.
