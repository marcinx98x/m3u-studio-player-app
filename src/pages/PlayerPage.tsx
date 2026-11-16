import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCatchupUrlFromListing, buildStreamUrl } from '../api/xtreamClient';
import EpgGrid from '../components/epg/EpgGrid';
import EpgNowBar from '../components/epg/EpgNowBar';
import PlayerOverlayLayout from '../components/layout/PlayerOverlayLayout';
import PlayerShell from '../components/layout/PlayerShell';
import ChannelList from '../components/live/ChannelList';
import VideoPlayer from '../components/player/VideoPlayer';
import VodBrowser from '../components/vod/VodBrowser';
import { usePlayerSession } from '../context/PlayerSessionContext';
import { useFavorites } from '../hooks/useFavorites';
import { useChannelEpgArchive } from '../hooks/useChannelEpgArchive';
import { useShortEpgNow } from '../hooks/useShortEpgNow';
import { useXtreamCatalog } from '../hooks/useXtreamCatalog';
import { resolveEpgDisplayTimezone } from '../utils/epg';
import type { PlayerTab, XtreamEpgListing, XtreamLiveStream } from '../types/xtream';

export default function PlayerPage() {
  const { creds, userInfo, serverInfo } = usePlayerSession();
  const audioTranscodeAvailable = serverInfo?.audio_transcode === 1;
  const epgDisplayTimeZone = resolveEpgDisplayTimezone(serverInfo?.timezone);
  const catalog = useXtreamCatalog(creds);
  const { isFavorite, toggle, favoriteIds } = useFavorites(creds?.username);

  const [tab, setTab] = useState<PlayerTab>('live');
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false);
  const [epgSidebarOpen, setEpgSidebarOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeChannel, setActiveChannel] = useState<XtreamLiveStream | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [playingEpgListing, setPlayingEpgListing] = useState<XtreamEpgListing | null>(
    null,
  );
  const [pendingCatchupOffsetSec, setPendingCatchupOffsetSec] = useState<number | null>(
    null,
  );
  const epgStreamId =
    tab === 'live' || tab === 'favorites' || tab === 'epg'
      ? (activeChannel?.stream_id ?? null)
      : null;
  const { now: epgNow, next: epgNext, loading: epgLoading } = useShortEpgNow(creds, epgStreamId);
  const { archivedListings } = useChannelEpgArchive(creds, activeChannel);
  const channelBarName = streamUrl ? streamTitle : activeChannel?.name;

  const hasVod = catalog.vodStreams.length > 0;
  const hasSeries = catalog.seriesList.length > 0;

  const tabs = useMemo(
    () => [
      { id: 'live' as const, label: 'Live' },
      { id: 'epg' as const, label: 'EPG' },
      { id: 'favorites' as const, label: 'Ulubione' },
      { id: 'vod' as const, label: 'Filmy / Seriale', hidden: !hasVod && !hasSeries },
    ],
    [hasVod, hasSeries],
  );

  useEffect(() => {
    if (tab !== 'live' && tab !== 'favorites') {
      setChannelSidebarOpen(false);
      setEpgSidebarOpen(false);
    }
  }, [tab]);

  const toggleChannelSidebar = useCallback(() => {
    setChannelSidebarOpen((open) => !open);
  }, []);

  const toggleEpgSidebar = useCallback(() => {
    setEpgSidebarOpen((open) => !open);
  }, []);

  const closeOverlayDrawers = useCallback(() => {
    setChannelSidebarOpen(false);
    setEpgSidebarOpen(false);
  }, []);

  const channelsInView = useMemo(() => {
    let list = catalog.liveStreams;
    if (favoritesOnly || tab === 'favorites') {
      const favSet = new Set(favoriteIds);
      list = list.filter((c) => favSet.has(c.stream_id));
    }
    return list;
  }, [catalog.liveStreams, favoritesOnly, tab, favoriteIds]);

  const selectChannel = (ch: XtreamLiveStream) => {
    setActiveChannel(ch);
  };

  const playLive = (ch: XtreamLiveStream) => {
    if (!creds) return;
    setActiveChannel(ch);
    setPlayingEpgListing(null);
    setPendingCatchupOffsetSec(null);
    setStreamTitle(ch.name);
    setStreamUrl(buildStreamUrl(creds, 'live', ch.stream_id));
    setTab('live');
  };

  const playArchiveListing = useCallback(
    (listing: XtreamEpgListing, offsetSec?: number) => {
      if (!creds || !activeChannel) return;
      setActiveChannel(activeChannel);
      setPlayingEpgListing(listing);
      setStreamTitle(`${activeChannel.name} (archiwum)`);
      setStreamUrl(buildCatchupUrlFromListing(creds, activeChannel.stream_id, listing));
      setPendingCatchupOffsetSec(
        offsetSec !== undefined && offsetSec > 0 ? offsetSec : null,
      );
      setTab('live');
    },
    [creds, activeChannel],
  );

  const clearPendingCatchupOffset = useCallback(() => {
    setPendingCatchupOffsetSec(null);
  }, []);

  const playVod = (streamId: number, ext?: string) => {
    if (!creds) return;
    setPlayingEpgListing(null);
    const item = catalog.vodStreams.find((v) => v.stream_id === streamId);
    setStreamTitle(item?.name ?? 'Film');
    setStreamUrl(buildStreamUrl(creds, 'movie', streamId, ext));
    setTab('live');
  };

  const playEpisode = (episodeId: string, ext?: string) => {
    if (!creds) return;
    setPlayingEpgListing(null);
    setStreamTitle('Odcinek');
    setStreamUrl(buildStreamUrl(creds, 'series', episodeId, ext));
    setTab('live');
  };

  const stopPlayback = () => {
    setStreamUrl(null);
    setPlayingEpgListing(null);
    setPendingCatchupOffsetSec(null);
  };

  const goLive = () => {
    if (!creds || !activeChannel) return;
    playLive(activeChannel);
  };

  const listProps = {
    channels: channelsInView,
    categories: catalog.liveCategories,
    grouped: catalog.liveCategories.length > 0,
    activeStreamId: activeChannel?.stream_id ?? null,
    search,
    onSearchChange: setSearch,
    onSelect: selectChannel,
    isFavorite,
    onToggleFavorite: toggle,
  };

  const videoPlayerProps = {
    streamUrl,
    onStop: stopPlayback,
    onGoLive: goLive,
    activeChannel,
    epgNow,
    playingEpgListing,
    archivedListings,
    displayTimeZone: epgDisplayTimeZone,
    onPlayArchiveListing: playArchiveListing,
    onPlayLive: goLive,
    pendingCatchupOffsetSec,
    onPendingCatchupSeekApplied: clearPendingCatchupOffset,
    audioTranscodeAvailable,
  };

  const epgNowBar = (
    <EpgNowBar
      streamId={epgStreamId}
      channelName={channelBarName}
      epgNow={epgNow}
      epgNext={epgNext}
      epgLoading={epgLoading}
      displayTimeZone={epgDisplayTimeZone}
    />
  );

  const overlayLayoutProps = {
    onBackdropClick: closeOverlayDrawers,
    left: {
      open: channelSidebarOpen,
      id: 'player-channel-drawer',
    },
  };

  const epgDrawer =
    epgSidebarOpen && creds
      ? {
          open: true,
          id: 'player-epg-drawer',
          panel: (
            <EpgGrid
              creds={creds}
              channel={activeChannel}
              displayTimeZone={epgDisplayTimeZone}
              onPlayCatchup={playArchiveListing}
              playingEpgListing={playingEpgListing}
              variant="drawer"
            />
          ),
        }
      : undefined;

  if (!creds) return null;

  return (
    <PlayerShell
      tabs={tabs}
      activeTab={tab}
      onTabChange={(t) => setTab(t as PlayerTab)}
      showChannelMenuToggle={tab === 'live' || tab === 'favorites'}
      channelMenuOpen={channelSidebarOpen}
      onChannelMenuToggle={toggleChannelSidebar}
      showEpgMenuToggle={tab === 'live' || tab === 'favorites'}
      epgMenuOpen={epgSidebarOpen}
      onEpgMenuToggle={toggleEpgSidebar}
      epgMenuDisabled={!activeChannel}
    >
      {catalog.error && (
        <div className="alert alert-danger m-3 py-2">{catalog.error}</div>
      )}
      {catalog.loading && (
        <div className="text-center p-4 text-muted">Ładowanie playlisty…</div>
      )}

      {tab === 'live' && !catalog.loading && (
        <PlayerOverlayLayout
          {...overlayLayoutProps}
          left={{
            ...overlayLayoutProps.left,
            panel: (
              <div className="player-sidebar">
                <ChannelList
                  {...listProps}
                  onPlay={playLive}
                  showFavoritesFilter
                  favoritesOnly={favoritesOnly}
                  onFavoritesOnlyChange={setFavoritesOnly}
                />
              </div>
            ),
          }}
          right={epgDrawer}
        >
          <div className="player-stage-body">
            <div className="player-stage-video">
              <VideoPlayer {...videoPlayerProps} />
            </div>
            {streamUrl && (
              <div className="player-stage-bottom">{epgNowBar}</div>
            )}
          </div>
        </PlayerOverlayLayout>
      )}

      {tab === 'epg' && (
        <div className="player-layout player-layout-epg">
          <aside className="player-sidebar narrow">
            <ChannelList
              channels={catalog.liveStreams}
              categories={catalog.liveCategories}
              grouped={catalog.liveCategories.length > 0}
              activeStreamId={activeChannel?.stream_id ?? null}
              search={search}
              onSearchChange={setSearch}
              onSelect={selectChannel}
            />
          </aside>
          <EpgGrid
            creds={creds}
            channel={activeChannel}
            displayTimeZone={epgDisplayTimeZone}
            onPlayCatchup={playArchiveListing}
            playingEpgListing={playingEpgListing}
          />
        </div>
      )}

      {tab === 'favorites' && (
        <PlayerOverlayLayout
          {...overlayLayoutProps}
          left={{
            ...overlayLayoutProps.left,
            panel: (
              <div className="player-sidebar">
                <ChannelList {...listProps} onPlay={playLive} />
              </div>
            ),
          }}
          right={epgDrawer}
        >
          <div className="player-stage-body">
            <div className="player-stage-video">
              <VideoPlayer {...videoPlayerProps} />
            </div>
          </div>
        </PlayerOverlayLayout>
      )}

      {tab === 'vod' && (hasVod || hasSeries) && (
        <div className="player-layout player-layout-vod">
          <div className="player-stage flex-grow-1">
            <VideoPlayer
              streamUrl={streamUrl}
              title={streamTitle}
              onStop={stopPlayback}
              audioTranscodeAvailable={audioTranscodeAvailable}
            />
          </div>
          <aside className="player-sidebar wide">
            <VodBrowser
              creds={creds}
              vodStreams={catalog.vodStreams}
              seriesList={catalog.seriesList}
              vodTruncated={catalog.vodTruncated}
              onPlayVod={playVod}
              onPlayEpisode={playEpisode}
            />
          </aside>
        </div>
      )}

      {userInfo?.exp_date && (
        <footer className="player-footer flex-shrink-0 small text-muted text-center py-2">
          Konto ważne do:{' '}
          {typeof userInfo.exp_date === 'number'
            ? new Date(userInfo.exp_date * 1000).toLocaleDateString('pl-PL')
            : userInfo.exp_date}
        </footer>
      )}
    </PlayerShell>
  );
}
