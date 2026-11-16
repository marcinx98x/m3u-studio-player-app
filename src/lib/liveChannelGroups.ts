import type { XtreamCategory, XtreamLiveStream } from '../types/xtream';

export interface LiveChannelGroup {
  categoryId: string;
  categoryName: string;
  channels: XtreamLiveStream[];
}

const OTHER_GROUP_ID = '__other__';
const OTHER_GROUP_NAME = 'Inne';

/**
 * Groups live streams by Xtream category order (same order as get_live_categories).
 */
export function buildLiveChannelGroups(
  categories: XtreamCategory[],
  streams: XtreamLiveStream[],
): LiveChannelGroup[] {
  const byCat = new Map<string, XtreamLiveStream[]>();
  for (const ch of streams) {
    const id = String(ch.category_id ?? '');
    if (!byCat.has(id)) {
      byCat.set(id, []);
    }
    byCat.get(id)!.push(ch);
  }

  const sortChannels = (list: XtreamLiveStream[]) =>
    [...list].sort((a, b) => {
      const na = a.num ?? 999999;
      const nb = b.num ?? 999999;
      if (na !== nb) return na - nb;
      return (a.name || '').localeCompare(b.name || '', 'pl');
    });

  const groups: LiveChannelGroup[] = [];
  const used = new Set<string>();

  for (const cat of categories) {
    const id = String(cat.category_id);
    const channels = byCat.get(id);
    if (!channels?.length) continue;
    used.add(id);
    groups.push({
      categoryId: id,
      categoryName: cat.category_name || id,
      channels: sortChannels(channels),
    });
  }

  const orphan: XtreamLiveStream[] = [];
  for (const [id, channels] of byCat) {
    if (!used.has(id) && channels.length > 0) {
      orphan.push(...channels);
    }
  }
  if (orphan.length > 0) {
    groups.push({
      categoryId: OTHER_GROUP_ID,
      categoryName: OTHER_GROUP_NAME,
      channels: sortChannels(orphan),
    });
  }

  return groups;
}

export function filterGroupsBySearch(
  groups: LiveChannelGroup[],
  query: string,
): LiveChannelGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  return groups
    .map((g) => ({
      ...g,
      channels: g.channels.filter((c) => c.name.toLowerCase().includes(q)),
    }))
    .filter((g) => g.channels.length > 0);
}

export function allGroupKeys(groups: LiveChannelGroup[]): string[] {
  return groups.map((g) => g.categoryId);
}
