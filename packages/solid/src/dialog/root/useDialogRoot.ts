import { createRenderEffect, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useScrollLock } from '../../solid-utils/useScrollLock';
import { useDismiss } from '../../floating-ui-react';
import { contains, getTarget } from '../../floating-ui-react/utils/element';
import { DialogStore } from '../store/DialogStore';
import { usePopupInteractionProps } from '../../utils/popups';
import type { HTMLProps } from '../../internals/types';

/**
 * Sets up the dialog's dismissal and nesting interactions.
 *
 * Solid port note: the React version is conditionally rendered by the root
 * while the dialog is open or mounted; here it stays mounted (so sibling
 * children stay stable) and the `enabled` prop gates the hooks instead.
 */
export function DialogInteractions(props: {
  store: DialogStore<any>;
  parentContext: DialogStore<unknown>['context'] | undefined;
  isDrawer: boolean;
  enabled: boolean;
}): JSX.Element {
  const store = untrack(() => props.store);
  const parentContext = untrack(() => props.parentContext);
  const enabled = () => props.enabled;

  const open = store.useState('open');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const modal = store.useState('modal');
  const popupElement = store.useState('popupElement');
  const floatingRootContext = store.state.floatingRootContext;

  const [ownNestedOpenDialogs, setOwnNestedOpenDialogs] = createSignal(0, { ownedWrite: true });
  const [ownNestedOpenDrawers, setOwnNestedOpenDrawers] = createSignal(0, { ownedWrite: true });
  const isTopmost = () => ownNestedOpenDialogs() === 0;

  const dismiss = useDismiss(floatingRootContext, {
    get enabled() {
      return enabled();
    },
    outsidePressEvent() {
      if (store.context.internalBackdropRef.current || store.context.backdropRef.current) {
        return 'intentional';
      }
      // Ensure `aria-hidden` on outside elements is removed immediately
      // on outside press when trapping focus.
      return {
        mouse: store.select('modal') === 'trap-focus' ? ('sloppy' as const) : ('intentional' as const),
        touch: 'sloppy' as const,
      };
    },
    outsidePress(event) {
      if (!store.context.outsidePressEnabledRef.current) {
        return false;
      }

      // For mouse events, only accept left button (button 0)
      // For touch events, a single touch is equivalent to left button
      if ('button' in event && event.button !== 0) {
        return false;
      }
      if ('touches' in event) {
        // Outside press can be handled on `touchend`, where the lifted point is
        // reported in `changedTouches` and `touches` contains any remaining
        // active points. Treat it as a single-finger tap only when exactly one
        // touch ended and no other fingers are still down.
        if (event.type === 'touchend') {
          if (event.changedTouches.length !== 1 || event.touches.length !== 0) {
            return false;
          }
        } else if (event.touches.length !== 1) {
          return false;
        }
      }

      const target = getTarget(event) as Element | null;
      if (untrack(isTopmost) && !store.select('disablePointerDismissal')) {
        // Only close if the click occurred on the dialog's owning backdrop.
        // This supports multiple modal dialogs that aren't nested in the tree:
        // https://github.com/mui/base-ui/issues/1320
        if (store.select('modal')) {
          const internalBackdrop = store.context.internalBackdropRef.current;
          const backdrop = store.context.backdropRef.current;
          return internalBackdrop || backdrop
            ? internalBackdrop === target ||
                backdrop === target ||
                (contains(target, store.select('popupElement')) &&
                  !target?.hasAttribute('data-base-ui-portal'))
            : true;
        }
        return true;
      }
      return false;
    },
    get escapeKey() {
      return isTopmost();
    },
  });

  useScrollLock(() => open() && modal() === true, popupElement);

  // Listen for nested open/close events on this store to maintain the counts.
  // A close notification is an open notification with zeroed counts.
  const handleNestedDialogOpen = (dialogCount: number, drawerCount: number) => {
    setOwnNestedOpenDialogs(dialogCount);
    setOwnNestedOpenDrawers(drawerCount);
  };
  store.useContextCallback('onNestedDialogOpen', () => handleNestedDialogOpen);

  // Notify parent of our open/close state using parent callbacks, if any
  createRenderEffect(
    () => ({
      isDrawer: props.isDrawer,
      open: open(),
      dialogs: ownNestedOpenDialogs(),
      drawers: ownNestedOpenDrawers(),
    }),
    (current) => {
      if (parentContext?.onNestedDialogOpen) {
        if (current.open) {
          parentContext.onNestedDialogOpen(
            current.dialogs + 1,
            current.drawers + (current.isDrawer ? 1 : 0),
          );
        } else {
          parentContext.onNestedDialogOpen(0, 0);
        }
      }
      return () => {
        if (parentContext?.onNestedDialogOpen && current.open) {
          parentContext.onNestedDialogOpen(0, 0);
        }
      };
    },
  );

  usePopupInteractionProps(store, {
    // `trigger` is the same object as `reference` in `useDismiss`, and the
    // props resolve to `undefined` while the interactions are disabled.
    get activeTriggerProps(): HTMLProps {
      return dismiss.reference ?? EMPTY_OBJECT;
    },
    get inactiveTriggerProps(): HTMLProps {
      return dismiss.trigger ?? EMPTY_OBJECT;
    },
    // DialogPopup and DrawerPopup spread `FOCUSABLE_POPUP_PROPS` directly, so
    // this only needs to carry the dismiss handlers.
    get popupProps(): HTMLProps {
      return dismiss.floating ?? EMPTY_OBJECT;
    },
    get nestedOpenDialogCount() {
      return ownNestedOpenDialogs();
    },
    get nestedOpenDrawerCount() {
      return ownNestedOpenDrawers();
    },
  });

  return null;
}
