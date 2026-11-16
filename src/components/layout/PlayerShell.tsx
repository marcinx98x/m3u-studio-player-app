import type { ReactNode } from 'react';
import { APP_TITLE } from '../../config/env';
import { usePlayerSession } from '../../context/PlayerSessionContext';

interface PlayerShellProps {
  children: ReactNode;
  tabs: { id: string; label: string; hidden?: boolean }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  showChannelMenuToggle?: boolean;
  channelMenuOpen?: boolean;
  onChannelMenuToggle?: () => void;
  showEpgMenuToggle?: boolean;
  epgMenuOpen?: boolean;
  onEpgMenuToggle?: () => void;
  epgMenuDisabled?: boolean;
}

export default function PlayerShell({
  children,
  tabs,
  activeTab,
  onTabChange,
  showChannelMenuToggle = false,
  channelMenuOpen = false,
  onChannelMenuToggle,
  showEpgMenuToggle = false,
  epgMenuOpen = false,
  onEpgMenuToggle,
  epgMenuDisabled = false,
}: PlayerShellProps) {
  const { userInfo, logout } = usePlayerSession();

  return (
    <div className="player-app d-flex flex-column">
      <header className="player-header d-flex align-items-center justify-content-between px-3 py-2 flex-shrink-0">
        <div>
          <span className="player-brand">{APP_TITLE}</span>
          {userInfo?.username && (
            <span className="text-muted small ms-2">({userInfo.username})</span>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {userInfo?.max_connections && (
            <span className="badge bg-secondary" title="Limit połączeń">
              max {userInfo.max_connections}
            </span>
          )}
          <button type="button" className="btn btn-sm btn-outline-light" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </header>

      {userInfo?.message && (
        <div className="alert alert-info py-2 mx-3 mb-0 small flex-shrink-0">{userInfo.message}</div>
      )}

      <nav className="player-tabs px-3 flex-shrink-0">
        <div className="player-tabs-row">
          {showChannelMenuToggle && onChannelMenuToggle && (
            <button
              type="button"
              className={`player-tab player-tab--drawer player-tab--drawer-icon${channelMenuOpen ? ' active' : ''}`}
              onClick={onChannelMenuToggle}
              aria-expanded={channelMenuOpen}
              aria-controls="player-channel-drawer"
              aria-label={channelMenuOpen ? 'Ukryj listę kanałów' : 'Pokaż listę kanałów'}
            >
              {channelMenuOpen ? '‹' : '☰'}
            </button>
          )}
          <div className="player-tabs-inner">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`player-tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => onTabChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
          </div>
          {showEpgMenuToggle && onEpgMenuToggle && (
            <button
              type="button"
              className={`player-tab player-tab--drawer player-tab--drawer-epg${epgMenuOpen ? ' active' : ''}`}
              onClick={onEpgMenuToggle}
              disabled={epgMenuDisabled}
              aria-expanded={epgMenuOpen}
              aria-controls="player-epg-drawer"
              aria-label={epgMenuOpen ? 'Ukryj program EPG' : 'Pokaż program EPG'}
            >
              {epgMenuOpen ? '›' : 'EPG'}
            </button>
          )}
        </div>
      </nav>

      <main className="player-main flex-grow-1">{children}</main>
    </div>
  );
}
