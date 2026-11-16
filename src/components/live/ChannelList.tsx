import { useEffect, useMemo, useState } from 'react';
import { channelHasArchive, sanitizeStreamIconUrl } from '../../api/xtreamClient';
import {
  allGroupKeys,
  buildLiveChannelGroups,
  filterGroupsBySearch,
  type LiveChannelGroup,
} from '../../lib/liveChannelGroups';
import type { XtreamCategory, XtreamLiveStream } from '../../types/xtream';

interface ChannelListProps {
  channels: XtreamLiveStream[];
  categories?: XtreamCategory[];
  grouped?: boolean;
  activeStreamId: number | null;
  search: string;
  onSearchChange: (q: string) => void;
  onSelect: (ch: XtreamLiveStream) => void;
  onPlay?: (ch: XtreamLiveStream) => void;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
  showFavoritesFilter?: boolean;
  favoritesOnly?: boolean;
  onFavoritesOnlyChange?: (only: boolean) => void;
}

function ChannelRow({
  ch,
  active,
  onSelect,
  onPlay,
  isFavorite,
  onToggleFavorite,
}: {
  ch: XtreamLiveStream;
  active: boolean;
  onSelect: (ch: XtreamLiveStream) => void;
  onPlay?: (ch: XtreamLiveStream) => void;
  isFavorite?: (id: number) => boolean;
  onToggleFavorite?: (id: number) => void;
}) {
  const iconUrl = sanitizeStreamIconUrl(ch.stream_icon);
  return (
    <li
      className={`list-group-item list-group-item-action channel-row ${active ? 'active' : ''}`}
    >
      <button
        type="button"
        className="channel-row-main"
        onClick={() => onSelect(ch)}
        onDoubleClick={() => onPlay?.(ch)}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="" className="channel-logo" loading="lazy" />
        ) : (
          <span className="channel-logo placeholder" />
        )}
        <span className="channel-name">
          {ch.name}
          {channelHasArchive(ch) && (
            <span className="badge bg-secondary ms-1" title="Archiwum TV">
              ↺
            </span>
          )}
        </span>
      </button>
      {onToggleFavorite && isFavorite && (
        <button
          type="button"
          className={`btn btn-sm btn-link fav-btn ${isFavorite(ch.stream_id) ? 'text-warning' : ''}`}
          title="Ulubione"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(ch.stream_id);
          }}
        >
          {isFavorite(ch.stream_id) ? '★' : '☆'}
        </button>
      )}
    </li>
  );
}

export default function ChannelList({
  channels,
  categories = [],
  grouped = false,
  activeStreamId,
  search,
  onSearchChange,
  onSelect,
  onPlay,
  isFavorite,
  onToggleFavorite,
  showFavoritesFilter,
  favoritesOnly,
  onFavoritesOnlyChange,
}: ChannelListProps) {
  const groups = useMemo(() => {
    if (!grouped || categories.length === 0) {
      return null;
    }
    const built = buildLiveChannelGroups(categories, channels);
    return filterGroupsBySearch(built, search);
  }, [grouped, categories, channels, search]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!groups) return;
    const keys = allGroupKeys(groups);
    const q = search.trim();
    if (q) {
      setExpandedKeys(new Set(keys));
      return;
    }
    setExpandedKeys((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        if (keys.includes(k)) next.add(k);
      }
      return next;
    });
  }, [groups, search]);

  const flatFiltered = useMemo(() => {
    if (grouped) return [];
    const q = search.trim().toLowerCase();
    return q ? channels.filter((c) => c.name.toLowerCase().includes(q)) : channels;
  }, [grouped, channels, search]);

  const toggleGroup = (categoryId: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const renderGroups = (list: LiveChannelGroup[]) =>
    list.map((group, idx) => {
      const expanded = expandedKeys.has(group.categoryId);
      return (
        <div
          key={group.categoryId}
          className={`channel-group ${idx % 2 === 1 ? 'channel-group-alt' : ''}`}
        >
          <button
            type="button"
            className="channel-group-header"
            onClick={() => toggleGroup(group.categoryId)}
            aria-expanded={expanded}
          >
            <span className="channel-group-chevron" aria-hidden>
              {expanded ? '▼' : '▶'}
            </span>
            <span className="channel-group-title">{group.categoryName}</span>
            <span className="channel-group-count">{group.channels.length}</span>
          </button>
          {expanded && (
            <ul className="list-group list-group-flush channel-group-body">
              {group.channels.map((ch) => (
                <ChannelRow
                  key={ch.stream_id}
                  ch={ch}
                  active={activeStreamId === ch.stream_id}
                  onSelect={onSelect}
                  onPlay={onPlay}
                  isFavorite={isFavorite}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </ul>
          )}
        </div>
      );
    });

  const empty =
    grouped && groups
      ? groups.length === 0
      : flatFiltered.length === 0;

  return (
    <div className="channel-list">
      {showFavoritesFilter && onFavoritesOnlyChange && (
        <div className="channel-list-filters mb-2">
          <button
            type="button"
            className={`btn btn-sm ${!favoritesOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => onFavoritesOnlyChange(false)}
          >
            Wszystkie
          </button>
          <button
            type="button"
            className={`btn btn-sm ${favoritesOnly ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => onFavoritesOnlyChange(true)}
          >
            ★ Ulubione
          </button>
        </div>
      )}
      <input
        type="search"
        className="form-control form-control-sm mb-1"
        placeholder="Szukaj kanału…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {onPlay && (
        <p className="channel-list-hint small text-muted mb-2">Dwuklik — odtwórz</p>
      )}
      <div className="channel-list-scroll">
        {grouped && groups ? (
          <>
            {renderGroups(groups)}
            {empty && <p className="text-muted small px-2 py-2">Brak kanałów</p>}
          </>
        ) : (
          <ul className="list-group list-group-flush">
            {flatFiltered.map((ch) => (
              <ChannelRow
                key={ch.stream_id}
                ch={ch}
                active={activeStreamId === ch.stream_id}
                onSelect={onSelect}
                onPlay={onPlay}
                isFavorite={isFavorite}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
            {empty && <li className="list-group-item text-muted small">Brak kanałów</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
