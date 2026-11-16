import { useEffect } from 'react';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

interface UsePlayerKeyboardOptions {
  enabled: boolean;
  onTogglePlayPause: () => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onStop: () => void;
}

export function usePlayerKeyboard({
  enabled,
  onTogglePlayPause,
  onToggleFullscreen,
  onToggleMute,
  onStop,
}: UsePlayerKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          onTogglePlayPause();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          onToggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          onToggleMute();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          onStop();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onTogglePlayPause, onToggleFullscreen, onToggleMute, onStop]);
}
