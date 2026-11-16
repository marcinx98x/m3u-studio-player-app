# M3U Studio Player

Webowy odtwarzacz IPTV dla **subkont** M3U Studio. Logowanie: login i hasło Xtream subkonta (bez wpisywania adresu serwera). Po logowaniu API wydaje opaque `player_session` — hasło nie trafia do URL streamów ani do `sessionStorage`.

- Produkcja: **https://m3u-studio-player.marcincloud.org**
- API Xtream: **https://m3u-studio.marcincloud.org/api/xtream/**

## Lokalny development

```powershell
cd "C:\Users\marcin\Desktop\Projekty\m3u-studio\m3u-studio-player-app"
npm install
npm run dev
```

Otwórz **http://localhost:5174** (nie 5173 — to port studia).

W dev żądania Xtream idą na `/api/xtream/...` przez Vite proxy na `https://m3u-studio.marcincloud.org`. Opcjonalnie `.env.local`:

```env
VITE_DEV_PROXY_TARGET=https://m3u-studio.marcincloud.org
```

## Build i testy

```powershell
npm run build
npm test
npm run build:www
```

`npm run build:www` buduje frontend i zbiera lokalny docroot `www\` (`index.html`, `assets/`, `.htaccess`). Wgraj **zawartość** `www/` na vhost `m3u-studio-player.marcincloud.org`.

Aktualny [`.env.production`](.env.production) używa **Opcji A (CORS)**:

```env
VITE_XTREAM_SERVER=https://m3u-studio.marcincloud.org/api/xtream
VITE_BASE_PATH=/
```

**Wdrożenie PHP na studiu:** skopiuj `m3u-studio-app/api/xtream/` (m.in. `player_api.php`, `live.php`, `movie.php`, `series.php`, `xtream_player_session.php`, `.htaccess`) na serwer studia.

### Produkcja — Opcja A: CORS (obecna konfiguracja)

1. W `api/config.php` studia (`IPTV_CORS_ORIGINS`) dodaj:

```
https://m3u-studio-player.marcincloud.org,http://localhost:5174
```

2. Build playera z `VITE_XTREAM_SERVER=https://m3u-studio.marcincloud.org/api/xtream`.

### Produkcja — Opcja B: Apache reverse proxy

W VirtualHost subdomeny playera ustaw `ProxyPass /api/` na studio i w buildzie użyj `VITE_XTREAM_SERVER=/api/xtream` (patrz `.env.production.example`).

Skopiuj [`public/apache-player.htaccess.example`](public/apache-player.htaccess.example) do `dist/.htaccess` (CSP, Referrer-Policy, SPA fallback).

## Checklist testów

- [ ] Logowanie poprawnym subkontem Xtream
- [ ] Po logowaniu w Network streamy mają `/live/s/{session}/…` (bez hasła w path)
- [ ] Błędne hasło — czytelny komunikat
- [ ] Lista kategorii i kanałów live
- [ ] Odtwarzanie kanału (HLS) + „Spróbuj ponownie” przy błędzie
- [ ] EPG „teraz” odświeża się po końcu programu
- [ ] Catchup z archiwum
- [ ] Ulubione
- [ ] VOD / seriale
- [ ] Wylogowanie
- [ ] Limit `max_connections` — komunikat przy 429

## Zmienne środowiska

| Zmienna | Opis |
|---------|------|
| `VITE_XTREAM_SERVER` | Bazowy URL API Xtream (bez końcowego `/`) |
| `VITE_BASE_PATH` | Base path Vite / React Router |
| `VITE_DEV_PROXY_TARGET` | Cel proxy `/api` w dev |

Audyt: [docs/AUDIT_FINDINGS_PLAYER.md](docs/AUDIT_FINDINGS_PLAYER.md).
