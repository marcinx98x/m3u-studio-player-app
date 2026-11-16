import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const HIDE_DELAY_MS = 3000;

export function usePlayerControlsVisibility(
  active: boolean,
  forceVisible: boolean,
) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!active || forceVisible) return;
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_DELAY_MS);
  }, [active, forceVisible, clearHideTimer]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (!active) {
      setControlsVisible(true);
      clearHideTimer();
      return;
    }
    if (forceVisible) {
      setControlsVisible(true);
      clearHideTimer();
      return;
    }
    scheduleHide();
    return clearHideTimer;
  }, [active, forceVisible, scheduleHide, clearHideTimer]);

  const onMouseMove = useCallback(() => {
    if (!active) return;
    showControls();
  }, [active, showControls]);

  const onMouseLeave = useCallback(() => {
    if (!active || forceVisible) return;
    scheduleHide();
  }, [active, forceVisible, scheduleHide]);

  const onTouchStart = useCallback(() => {
    if (!active) return;
    showControls();
  }, [active, showControls]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!active) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        showControls();
      }
    },
    [active, showControls],
  );

  return {
    controlsVisible: !active || forceVisible || controlsVisible,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onPointerDown,
    showControls,
  };
}
