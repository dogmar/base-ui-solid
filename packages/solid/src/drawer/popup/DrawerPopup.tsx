import { createEffect, createRenderEffect, createSignal, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { error } from '@base-ui/utils/error';
import type { InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { FloatingFocusManager } from '../../floating-ui-react';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupTransitionStateMapping } from '../../utils/popupStateMapping';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from './DrawerPopupCssVars';
import * as DrawerPopupDataAttributes from './DrawerPopupDataAttributes';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';
import { mergeProps } from '../../merge-props';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import type { RefObject } from '../../solid-utils/refs';

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  ...popupTransitionStateMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return { [DrawerPopupDataAttributes.swipeDirection]: value };
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerPopup(componentProps: DrawerPopup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'finalFocus',
    'initialFocus',
  );

  const store = useDialogRootContext();
  const popupRef = store.context.popupRef;

  const drawerRootContext = useDrawerRootContext();
  const {
    swipeDirection,
    frontmostHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = drawerRootContext;

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDrawerCount = store.useState('nestedOpenDrawerCount');
  const transitionStatus = store.useState('transitionStatus');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const role = store.useState('role');
  const floatingRootContext = store.state.floatingRootContext;
  const floatingId = floatingRootContext.useState('floatingId');

  const popupId = () => (componentProps.id as string | undefined) ?? floatingId();

  const swipe = useDrawerViewportContext();
  useDialogPortalContext();
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints();

  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;
  const swiping = () => swipe?.swiping() ?? false;
  const swipeStrength = () => swipe?.swipeStrength() ?? null;

  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  let popupHeightCurrent = 0;

  /* istanbul ignore else -- process.env.NODE_ENV is a build-time constant. */
  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => null,
      () => {
        if (swipe) {
          return;
        }

        error(
          '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the ' +
            'viewport disables drawer swipe handling and touch scroll locking. Wrap ' +
            '<Drawer.Popup> in <Drawer.Viewport>.',
        );
      },
    );
  }

  const measureHeight = () => {
    const popupElement = popupRef.current;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (
      popupHeightCurrent > 0 &&
      untrack(frontmostHeight) > popupHeightCurrent &&
      offsetHeight > popupHeightCurrent
    ) {
      return;
    }

    const keepHeightWhileNested = popupHeightCurrent > 0 && untrack(hasNestedDrawer);
    if (keepHeightWhileNested) {
      const oldHeight = popupHeightCurrent;
      setPopupHeight(oldHeight);
      onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === popupHeightCurrent) {
      return;
    }

    popupHeightCurrent = nextHeight;
    setPopupHeight(nextHeight);
    onPopupHeightChange(nextHeight);
  };

  createRenderEffect(
    () => ({ mounted: mounted(), nestedDrawerOpen: nestedDrawerOpen() }),
    (current) => {
      if (!current.mounted) {
        popupHeightCurrent = 0;
        setPopupHeight(0);
        onPopupHeightChange(0);
        return undefined;
      }

      const popupElement = popupRef.current;
      if (!popupElement) {
        return undefined;
      }

      removeCSSVariableInheritance();
      measureHeight();

      if (typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureHeight);

      resizeObserver.observe(popupElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  createRenderEffect(
    () => null,
    () => {
      const syncNestedSwipeProgress = () => {
        const popupElement = popupRef.current;
        if (!popupElement) {
          return;
        }

        const progress = nestedSwipeProgressStore.getSnapshot();
        if (progress > 0) {
          popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
        } else {
          popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        }
      };

      syncNestedSwipeProgress();
      const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);
      const popupElement = popupRef.current;

      return () => {
        unsubscribe();
        if (popupElement) {
          popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
        }
      };
    },
  );

  createRenderEffect(
    () => ({ frontmostHeight: frontmostHeight(), open: open() }),
    (current) => {
      if (!current.open) {
        return undefined;
      }

      notifyParentFrontmostHeight?.(current.frontmostHeight);

      return () => {
        notifyParentFrontmostHeight?.(0);
      };
    },
  );

  createRenderEffect(
    () => ({ open: open(), transitionStatus: transitionStatus() }),
    (current) => {
      if (!notifyParentHasNestedDrawer) {
        return undefined;
      }

      const present = current.open || current.transitionStatus === 'ending';
      notifyParentHasNestedDrawer(present);

      return () => {
        notifyParentHasNestedDrawer(false);
      };
    },
  );

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: popupRef,
    onComplete() {
      if (untrack(open)) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = () =>
    componentProps.initialFocus === undefined ? popupRef : componentProps.initialFocus;

  const setPopupElement = store.useStateSetter('popupElement');

  const state: DrawerPopupState = {
    get open() {
      return open();
    },
    get nested() {
      return nested();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get expanded() {
      return activeSnapPoint() === 1;
    },
    get nestedDrawerOpen() {
      return nestedDrawerOpen();
    },
    get nestedDrawerSwiping() {
      return nestedSwiping();
    },
    get swipeDirection() {
      return swipeDirection();
    },
    get swiping() {
      return swiping();
    },
  };

  const computeStyle = (): JSX.CSSProperties => {
    const currentSwipeDirection = swipeDirection();
    const currentSnapPoints = snapPoints();
    const currentPopupHeight = popupHeight();
    const currentFrontmostHeight = frontmostHeight();
    const currentSwipeStrength = swipeStrength();
    const currentActiveSnapPointOffset = activeSnapPointOffset();
    const isSwiping = swiping();

    let popupHeightCssVarValue: string | undefined;
    const shouldUseAutoHeight = !hasNestedDrawer() && transitionStatus() !== 'ending';
    if (currentPopupHeight && !shouldUseAutoHeight) {
      popupHeightCssVarValue = `${currentPopupHeight}px`;
    }

    const shouldApplySnapPoints =
      currentSnapPoints &&
      currentSnapPoints.length > 0 &&
      (currentSwipeDirection === 'down' || currentSwipeDirection === 'up');
    let snapPointOffsetValue: number | null = null;
    if (shouldApplySnapPoints && currentActiveSnapPointOffset !== null) {
      snapPointOffsetValue =
        currentSwipeDirection === 'up'
          ? -currentActiveSnapPointOffset
          : currentActiveSnapPointOffset;
    }

    let dragStyles: JSX.CSSProperties = swipe ? swipe.getDragStyles() : (EMPTY_OBJECT as JSX.CSSProperties);
    if (shouldApplySnapPoints && currentSwipeDirection === 'down') {
      const baseOffset = currentActiveSnapPointOffset ?? 0;
      const movementValue = Number.parseFloat(
        String((dragStyles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY]),
      );

      if (isSwiping && Number.isFinite(movementValue)) {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
            baseOffset,
            movementValue,
          )}px`,
        } as JSX.CSSProperties;
      } else {
        dragStyles = {
          ...dragStyles,
          transform: undefined,
        };
      }
    }

    return {
      ...dragStyles,
      [DrawerBackdropCssVars.swipeProgress]: '0',
      [DrawerPopupCssVars.nestedDrawers]: String(nestedOpenDrawerCount()),
      [DrawerPopupCssVars.height]: popupHeightCssVarValue,
      [DrawerPopupCssVars.snapPointOffset]:
        typeof snapPointOffsetValue === 'number' ? `${snapPointOffsetValue}px` : '0px',
      [DrawerPopupCssVars.frontmostHeight]: currentFrontmostHeight
        ? `${currentFrontmostHeight}px`
        : undefined,
      [DrawerPopupCssVars.swipeStrength]:
        typeof currentSwipeStrength === 'number' &&
        Number.isFinite(currentSwipeStrength) &&
        currentSwipeStrength > 0
          ? `${currentSwipeStrength}`
          : '1',
    } as JSX.CSSProperties;
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      (merged) => mergeProps(merged, rootPopupProps()),
      {
        get id() {
          return popupId();
        },
        get 'aria-labelledby'() {
          return titleElementId();
        },
        get 'aria-describedby'() {
          return descriptionElementId();
        },
        get role() {
          return role();
        },
        ...FOCUSABLE_POPUP_PROPS,
        get hidden() {
          return !mounted();
        },
        onKeyDown(event: KeyboardEvent) {
          if (COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        get style() {
          return computeStyle();
        },
      },
      elementProps,
    ],
    ref: [popupRef, setPopupElement],
    stateAttributesMapping,
  });

  return (
    <IsolateChildren>
      <FloatingFocusManager
        context={floatingRootContext}
        openInteractionType={openMethod()}
        disabled={!mounted()}
        closeOnFocusOut={!disablePointerDismissal()}
        initialFocus={resolvedInitialFocus()}
        returnFocus={componentProps.finalFocus}
        modal={modal() !== false}
        restoreFocus="popup"
      >
        {element}
      </FloatingFocusManager>
    </IsolateChildren>
  );
}

export interface DrawerPopupProps extends BaseUIComponentProps<'div', DrawerPopupState> {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement>
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export namespace DrawerPopup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}
