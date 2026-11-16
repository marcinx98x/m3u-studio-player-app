import { useEffect, type ReactNode } from 'react';

export interface OverlayDrawerConfig {
  open: boolean;
  panel: ReactNode;
  id: string;
}

interface PlayerOverlayLayoutProps {
  left?: OverlayDrawerConfig;
  right?: OverlayDrawerConfig;
  onBackdropClick: () => void;
  children: ReactNode;
}

export default function PlayerOverlayLayout({
  left,
  right,
  onBackdropClick,
  children,
}: PlayerOverlayLayoutProps) {
  const anyOpen = Boolean(left?.open || right?.open);

  useEffect(() => {
    if (!anyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBackdropClick();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [anyOpen, onBackdropClick]);

  return (
    <div className="player-layout-overlay">
      <section className="player-stage player-stage--full">{children}</section>
      {anyOpen && (
        <div
          className="player-sidebar-backdrop"
          onClick={onBackdropClick}
          aria-hidden="true"
        />
      )}
      {left && (
        <aside
          id={left.id}
          className={`player-sidebar-drawer${left.open ? ' is-open' : ''}`}
          aria-hidden={!left.open}
        >
          {left.panel}
        </aside>
      )}
      {right && (
        <aside
          id={right.id}
          className={`player-sidebar-drawer player-sidebar-drawer--right${right.open ? ' is-open' : ''}`}
          aria-hidden={!right.open}
        >
          {right.panel}
        </aside>
      )}
    </div>
  );
}
