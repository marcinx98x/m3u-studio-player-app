import { useMemo, useState } from 'react';
import { getSeriesInfo, type XtreamCredentials } from '../../api/xtreamClient';
import type { XtreamSeries, XtreamVodStream } from '../../types/xtream';

interface VodBrowserProps {
  creds: XtreamCredentials;
  vodStreams: XtreamVodStream[];
  seriesList: XtreamSeries[];
  vodTruncated?: boolean;
  onPlayVod: (streamId: number, extension?: string) => void;
  onPlayEpisode: (episodeId: string, extension?: string) => void;
}

export default function VodBrowser({
  creds,
  vodStreams,
  seriesList,
  vodTruncated = false,
  onPlayVod,
  onPlayEpisode,
}: VodBrowserProps) {
  const [mode, setMode] = useState<'vod' | 'series'>('vod');
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<{ season: string; title: string; id: string; ext?: string }[]>(
    [],
  );

  const hasVod = vodStreams.length > 0;
  const hasSeries = seriesList.length > 0;

  const vodPreview = useMemo(() => vodStreams.slice(0, 200), [vodStreams]);

  const loadSeries = async (seriesId: number) => {
    setSelectedSeriesId(seriesId);
    setEpisodesLoading(true);
    setEpisodesError(null);
    try {
      const info = await getSeriesInfo(creds, seriesId);
      const rows: { season: string; title: string; id: string; ext?: string }[] = [];
      const eps = info.episodes ?? {};
      for (const [season, list] of Object.entries(eps)) {
        for (const ep of list) {
          rows.push({
            season,
            title: ep.title || `Odcinek ${ep.episode_num}`,
            id: ep.id,
            ext: ep.container_extension,
          });
        }
      }
      setEpisodes(rows);
      if (rows.length === 0) {
        setEpisodesError('Brak odcinków dla tego serialu.');
      }
    } catch (e) {
      setEpisodes([]);
      setEpisodesError(e instanceof Error ? e.message : 'Nie udało się załadować odcinków');
    } finally {
      setEpisodesLoading(false);
    }
  };

  if (!hasVod && !hasSeries) {
    return (
      <p className="text-muted small p-3">Serwer nie zwrócił filmów ani seriali (VOD wyłączone).</p>
    );
  }

  return (
    <div className="vod-browser p-3">
      {vodTruncated && (
        <p className="small text-warning mb-2">
          Lista filmów jest skrócona do pierwszych pozycji (limit katalogu).
        </p>
      )}
      <div className="btn-group btn-group-sm mb-3">
        {hasVod && (
          <button
            type="button"
            className={`btn btn-outline-light ${mode === 'vod' ? 'active' : ''}`}
            onClick={() => setMode('vod')}
          >
            Filmy
          </button>
        )}
        {hasSeries && (
          <button
            type="button"
            className={`btn btn-outline-light ${mode === 'series' ? 'active' : ''}`}
            onClick={() => setMode('series')}
          >
            Seriale
          </button>
        )}
      </div>

      {mode === 'vod' && hasVod && (
        <ul className="list-group list-group-flush vod-scroll">
          {vodPreview.map((v) => (
            <li key={v.stream_id} className="list-group-item list-group-item-action">
              <button
                type="button"
                className="btn btn-link text-start text-light p-0"
                onClick={() => onPlayVod(v.stream_id, v.container_extension)}
              >
                {v.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {mode === 'series' && hasSeries && (
        <div className="row g-2">
          <div className="col-md-5">
            <ul className="list-group list-group-flush vod-scroll">
              {seriesList.map((s) => (
                <li key={s.series_id}>
                  <button
                    type="button"
                    className={`list-group-item list-group-item-action ${
                      selectedSeriesId === s.series_id ? 'active' : ''
                    }`}
                    onClick={() => void loadSeries(s.series_id)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-md-7">
            {episodesLoading && <p className="small text-muted">Ładowanie odcinków…</p>}
            {episodesError && !episodesLoading && (
              <p className="small text-danger">{episodesError}</p>
            )}
            <ul className="list-group list-group-flush vod-scroll">
              {episodes.map((ep) => (
                <li key={ep.id} className="list-group-item">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => onPlayEpisode(ep.id, ep.ext)}
                  >
                    S{ep.season}: {ep.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
