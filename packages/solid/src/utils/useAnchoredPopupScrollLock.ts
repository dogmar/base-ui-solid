import { createRenderEffect, createSignal, type Accessor } from 'solid-js';
import { ownerDocument } from '@base-ui/utils/owner';
import { useScrollLock } from '../solid-utils/useScrollLock';

// Touch-opened popups normally avoid scroll locking so users can still swipe outside to dismiss.
// This hook re-enables scroll lock only when the popup is effectively full-width.
// Treat popups with up to 20px of total horizontal gutter as full-width so common ~10px side
// padding still locks scroll, since that leaves too little outside space for a reliable swipe.
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

/**
 * Manages scroll lock for anchored popups. For non-touch opens, scroll lock is applied when
 * enabled. For touch opens, scroll lock is applied only when the positioner width is effectively
 * viewport-sized.
 */
export function useAnchoredPopupScrollLock(
  enabled: Accessor<boolean>,
  touchOpen: Accessor<boolean>,
  positionerElement: Accessor<HTMLElement | null>,
  referenceElement: Accessor<Element | null>,
) {
  const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = createSignal(false, {
    ownedWrite: true,
  });

  createRenderEffect(
    () => ({
      enabled: enabled(),
      touchOpen: touchOpen(),
      positionerElement: positionerElement(),
    }),
    (current) => {
      if (!current.enabled || !current.touchOpen || current.positionerElement == null) {
        setTouchOpenShouldLockScroll(false);
        return;
      }

      const viewportWidth = ownerDocument(current.positionerElement).documentElement.clientWidth;
      const popupWidth = current.positionerElement.offsetWidth;

      setTouchOpenShouldLockScroll(
        viewportWidth > 0 &&
          popupWidth > 0 &&
          popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX,
      );
    },
  );

  useScrollLock(() => enabled() && (!touchOpen() || touchOpenShouldLockScroll()), referenceElement);
}
