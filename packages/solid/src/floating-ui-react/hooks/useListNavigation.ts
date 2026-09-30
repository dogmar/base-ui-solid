import { createRenderEffect, untrack } from 'solid-js';
import { NOOP } from '@base-ui/utils/empty';
import { ownerDocument } from '@base-ui/utils/owner';
import { platform } from '@base-ui/utils/platform';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useAnimationFrame } from '../../solid-utils/timers';
import { useFloatingParentNodeId, useFloatingTree } from '../components/FloatingTree';
import { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import {
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isIndexOutOfListBounds,
  type DisabledIndices,
} from '../utils/composite';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../utils/constants';
import {
  activeElement,
  contains,
  getFloatingFocusElement,
  getTarget,
  isTypeableCombobox,
} from '../utils/element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../utils/event';
import type { FocusableElement } from '../utils/tabbable';

export const ESCAPE = 'Escape';

// TODO(enqueueFocus): `utils/enqueueFocus.ts` is not ported yet (owned by
// another agent). This is a minimal local copy of the React implementation;
// replace with `import { enqueueFocus } from '../utils/enqueueFocus'` once it
// exists.
interface EnqueueFocusOptions {
  preventScroll?: boolean | undefined;
  sync?: boolean | undefined;
  // Called when the frame runs to decide whether focus should still be applied.
  shouldFocus?: (() => boolean) | undefined;
}

let rafId = 0;
function enqueueFocusLocal(el: FocusableElement | null, options: EnqueueFocusOptions = {}) {
  const { preventScroll = false, sync = false, shouldFocus } = options;

  cancelAnimationFrame(rafId);

  function exec() {
    if (shouldFocus && !shouldFocus()) {
      return;
    }
    el?.focus({ preventScroll });
  }

  if (sync) {
    exec();
    return NOOP;
  }

  const currentRafId = requestAnimationFrame(exec);
  rafId = currentRafId;
  return () => {
    if (rafId === currentRafId) {
      cancelAnimationFrame(currentRafId);
      rafId = 0;
    }
  };
}

// WebKit fires zero-delta `mousemove`/`pointermove` events when the list scrolls
// beneath a stationary pointer, moving the highlight during keyboard navigation.
// https://github.com/mui/base-ui/issues/4002
function isStationaryWebKitPointer(event: MouseEvent | PointerEvent) {
  return platform.engine.webkit && event.movementX === 0 && event.movementY === 0;
}

function doSwitch(
  orientation: UseListNavigationProps['orientation'],
  vertical: boolean,
  horizontal: boolean,
) {
  switch (orientation) {
    case 'vertical':
      return vertical;
    case 'horizontal':
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

function isMainOrientationKey(key: string, orientation: UseListNavigationProps['orientation']) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN;
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal);
}

function isMainOrientationToEndKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return (
    doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
  );
}

function isCrossOrientationOpenKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

function isCrossOrientationCloseKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
  grid: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === 'both' || (orientation === 'horizontal' && grid)) {
    return key === ESCAPE;
  }
  return doSwitch(orientation, vertical, horizontal);
}

// TODO(types): mirrors `typeof gridNavigation` from the React
// `hooks/gridNavigation.ts`, which is not ported yet. Replace with
// `typeof gridNavigation` once that module exists in the Solid package.
export type GridNavigationFunction = (
  event: KeyboardEvent,
  prevIndex: number,
  listRef: { current: Array<HTMLElement | null> },
  orientation: 'horizontal' | 'vertical' | 'both',
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols?: number,
) => number | undefined;

export interface UseListNavigationProps {
  /**
   * A ref that holds an array of list items.
   * @default empty list
   */
  listRef: { current: Array<HTMLElement | null> };
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   * @default null
   */
  activeIndex: number | null;
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?: ((activeIndex: number | null, event: Event | undefined) => void) | undefined;
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The currently selected item index, which may or may not be active.
   * @default null
   */
  selectedIndex?: number | null | undefined;
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: boolean | 'auto' | undefined;
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: boolean | undefined;
  /**
   * Whether pressing an arrow key on the navigation's main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: boolean | undefined;
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This prop allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select popups, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   * @default undefined
   */
  disabledIndices?: ReadonlyArray<number> | ((index: number) => boolean) | undefined;
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loopFocus` must be `true`.
   * @default false
   */
  allowEscape?: boolean | undefined;
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loopFocus?: boolean | undefined;
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: boolean | undefined;
  /**
   * Allows to specify the orientation of the parent list, which is used to
   * determine the direction of the navigation.
   * This is useful when list navigation is used within a Composite,
   * as the hook can't determine the orientation of the parent list automatically.
   */
  parentOrientation?: UseListNavigationProps['orientation'] | undefined;
  /**
   * Whether the direction of the floating element's navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: boolean | undefined;
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * @default false
   */
  virtual?: boolean | undefined;
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * The id of the root component.
   */
  id?: string | undefined;
  /**
   * Whether to clear the active index when the pointer leaves an item.
   * @default true
   */
  resetOnPointerLeave?: boolean | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Computes two-dimensional list navigation for grid-capable consumers.
   */
  grid?: GridNavigationFunction | null | undefined;
}

/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 *
 * Solid port notes: `props` should be a reactive object (use getters for
 * reactive values); the returned `ElementProps` object exposes its prop groups
 * through reactive getters.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function useListNavigation(
  context: FloatingRootContext | FloatingContext,
  props: UseListNavigationProps,
): ElementProps {
  const enabled = () => props.enabled ?? true;
  const selectedIndex = () => props.selectedIndex ?? null;
  const allowEscape = () => props.allowEscape ?? false;
  const loopFocus = () => props.loopFocus ?? false;
  const nested = () => props.nested ?? false;
  const rtl = () => props.rtl ?? false;
  const virtual = () => props.virtual ?? false;
  const focusItemOnOpen = () => props.focusItemOnOpen ?? 'auto';
  const focusItemOnHover = () => props.focusItemOnHover ?? true;
  const openOnArrowKeyDown = () => props.openOnArrowKeyDown ?? true;
  const orientation = () => props.orientation ?? 'vertical';
  const resetOnPointerLeave = () => props.resetOnPointerLeave ?? true;
  const disabledIndices = () => props.disabledIndices;
  const isGrid = () => props.grid != null;

  if (process.env.NODE_ENV !== 'production') {
    untrack(() => {
      if (allowEscape()) {
        if (!loopFocus()) {
          console.warn('`useListNavigation` looping must be enabled to allow escaping.');
        }

        if (!virtual()) {
          console.warn('`useListNavigation` must be virtual to allow escaping.');
        }
      }

      if (orientation() === 'vertical' && isGrid()) {
        console.warn(
          'In grid list navigation mode, the `orientation` should',
          'be either "horizontal" or "both".',
        );
      }
    });
  }

  const store = 'rootStore' in context ? context.rootStore : context;

  const open = store.useState('open');
  const floatingElement = store.useState('floatingElement');
  const domReferenceElement = store.useState('domReferenceElement');

  const dataRef = store.context.dataRef;

  // Synchronous reads for event handlers (equivalent of the React refs that
  // track the latest rendered values).
  const latestOpen = () => store.state.open;
  const floatingFocusEl = () => getFloatingFocusElement(store.state.floatingElement);
  const typeableComboboxReference = () => isTypeableCombobox(domReferenceElement());

  const parentId = useFloatingParentNodeId();
  const tree = useFloatingTree(untrack(() => props.externalTree));

  const focusItemOnOpenRef = { current: untrack(focusItemOnOpen) };
  const indexRef = { current: untrack(selectedIndex) ?? -1 };
  const keyRef = { current: null as null | string };
  const isPointerModalityRef = { current: true };

  const onNavigate = (event?: Event) => {
    props.onNavigate?.(indexRef.current === -1 ? null : indexRef.current, event);
  };

  const previousMountedRef = { current: !!store.state.floatingElement };
  const previousOpenRef = { current: store.state.open };
  const forceSyncFocusRef = { current: false };
  const forceScrollIntoViewRef = { current: false };
  const cancelQueuedFocusRef = { current: null as (() => void) | null };

  const focusFrame = useAnimationFrame();
  const waitForListPopulatedFrame = useAnimationFrame();

  const focusItem = () => {
    function runFocus(item: HTMLElement) {
      if (virtual()) {
        tree?.events.emit('virtualfocus', item);
      } else {
        cancelQueuedFocusRef.current = enqueueFocusLocal(item, {
          sync: forceSyncFocusRef.current,
          preventScroll: true,
        });
      }
    }

    const initialItem = props.listRef.current[indexRef.current];
    const forceScrollIntoView = forceScrollIntoViewRef.current;

    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocusRef.current
      ? (callback: () => void) => callback()
      : (callback: () => void) => focusFrame.request(callback);

    scheduler(() => {
      const waitedItem = props.listRef.current[indexRef.current] || initialItem;

      if (!waitedItem) {
        return;
      }

      if (!initialItem) {
        runFocus(waitedItem);
      }

      // Note: the React version also gates this on the `item` props object
      // being defined, which is always truthy.
      const shouldScrollIntoView = forceScrollIntoView || !isPointerModalityRef.current;

      if (shouldScrollIntoView) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });
  };

  createRenderEffect(
    () => orientation(),
    (orientationValue) => {
      dataRef.current.orientation = orientationValue;
    },
  );

  // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
  // element. Also, reset `activeIndex` upon closing the floating element.
  createRenderEffect(
    () => [enabled(), open(), floatingElement(), selectedIndex()] as const,
    ([enabledValue, openValue, floatingValue, selectedIndexValue]) => {
      if (!enabledValue) {
        return;
      }

      if (openValue && floatingValue) {
        indexRef.current = selectedIndexValue ?? -1;
        if (focusItemOnOpenRef.current && selectedIndexValue != null) {
          // Regardless of the pointer modality, we want to ensure the selected
          // item comes into view when the floating element is opened.
          forceScrollIntoViewRef.current = true;
          onNavigate();
        }
      } else if (previousMountedRef.current) {
        // Reset the active index when the list is no longer open and mounted (closing or
        // unmounting).
        indexRef.current = -1;
        onNavigate();
      }
    },
  );

  // Sync `activeIndex` to be the focused item while the floating element is
  // open.
  createRenderEffect(
    () =>
      [
        enabled(),
        open(),
        floatingElement(),
        props.activeIndex,
        nested(),
        orientation(),
        rtl(),
      ] as const,
    ([enabledValue, openValue, floatingValue, activeIndex]) => {
      if (!enabledValue) {
        return;
      }
      if (!openValue) {
        forceSyncFocusRef.current = false;
        return;
      }
      if (!floatingValue) {
        return;
      }

      if (activeIndex == null) {
        forceSyncFocusRef.current = false;

        if (selectedIndex() != null) {
          return;
        }

        // Reset while the floating element was open (e.g. the list changed).
        if (previousMountedRef.current) {
          indexRef.current = -1;
          focusItem();
        }

        // Initial sync.
        if (
          (!previousOpenRef.current || !previousMountedRef.current) &&
          focusItemOnOpenRef.current &&
          (keyRef.current != null ||
            (focusItemOnOpenRef.current === true && keyRef.current == null))
        ) {
          let runs = 0;
          const waitForListPopulated = () => {
            if (props.listRef.current[0] == null) {
              // Avoid letting the browser paint if possible on the first try,
              // otherwise use rAF. Don't try more than twice, since something
              // is wrong otherwise.
              if (runs < 2) {
                const scheduler = runs
                  ? (callback: () => void) => waitForListPopulatedFrame.request(callback)
                  : queueMicrotask;
                scheduler(waitForListPopulated);
              }
              runs += 1;
            } else {
              // Initially focus the first non-disabled item. `disabledIndices` is deliberately
              // omitted here so attribute-disabled items (`disabled`/`aria-disabled`) are skipped
              // on open even when the consumer passes an empty `disabledIndices` array. Passing it
              // would regress that behavior (see mui/base-ui#2604).
              indexRef.current =
                keyRef.current == null ||
                isMainOrientationToEndKey(keyRef.current, orientation(), rtl()) ||
                nested()
                  ? getMinListIndex(props.listRef)
                  : getMaxListIndex(props.listRef);
              keyRef.current = null;
              onNavigate();
            }
          };

          waitForListPopulated();
        }
      } else if (!isIndexOutOfListBounds(props.listRef.current, activeIndex)) {
        indexRef.current = activeIndex;
        focusItem();
        forceScrollIntoViewRef.current = false;
      }
    },
  );

  // Ensure the parent floating element has focus when a nested child closes
  // to allow arrow key navigation to work after the pointer leaves the child.
  createRenderEffect(
    () => [enabled(), floatingElement(), domReferenceElement(), virtual()] as const,
    ([enabledValue, floatingValue, domReferenceValue, virtualValue]) => {
      if (!enabledValue || floatingValue || !tree || virtualValue || !previousMountedRef.current) {
        return;
      }

      const nodes = tree.nodesRef.current;
      const parent = nodes.find((node) => node.id === parentId)?.context?.elements.floating();
      // `floatingElement` is null here (see the guard above), so resolve the owner document from an
      // in-DOM element for realm-safety (shadow DOM/iframes): the reference element, falling back to
      // the parent floating element when the reference is virtual (`domReferenceElement` is null).
      const activeEl = activeElement(ownerDocument(domReferenceValue ?? parent ?? null));
      const treeContainsActiveEl = nodes.some(
        (node) => node.context && contains(node.context.elements.floating(), activeEl),
      );

      if (parent && !treeContainsActiveEl && isPointerModalityRef.current) {
        parent.focus({ preventScroll: true });
      }
    },
  );

  // Mirrors the React "runs after every render" effect: only `open` and
  // `floatingElement` are read, so tracking just those two is equivalent.
  // Declared after the effects above so it runs last within a flush.
  createRenderEffect(
    () => [open(), floatingElement()] as const,
    ([openValue, floatingValue]) => {
      previousOpenRef.current = openValue;
      previousMountedRef.current = !!floatingValue;
    },
  );

  createRenderEffect(
    () => [open(), focusItemOnOpen()] as const,
    ([openValue, focusItemOnOpenValue]) => {
      if (!openValue) {
        keyRef.current = null;
        focusItemOnOpenRef.current = focusItemOnOpenValue;
      }
    },
  );

  const hasActiveIndex = () => props.activeIndex != null;

  const syncCurrentTarget = (event: Event) => {
    if (!latestOpen()) {
      return;
    }

    const index = props.listRef.current.indexOf(event.currentTarget as HTMLElement | null);
    if (index !== -1 && (indexRef.current !== index || props.activeIndex !== index)) {
      indexRef.current = index;
      onNavigate(event);
    }
  };

  const getParentOrientation = () => {
    return (
      props.parentOrientation ??
      (tree?.nodesRef.current.find((node) => node.id === parentId)?.context?.dataRef?.current
        .orientation as UseListNavigationProps['orientation'])
    );
  };

  const getMinEnabledIndex = () => {
    return getMinListIndex(props.listRef, disabledIndices());
  };

  const commonOnKeyDown = (event: KeyboardEvent) => {
    isPointerModalityRef.current = false;
    forceSyncFocusRef.current = true;

    // When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
    // don't appear to suffer from this. `event.isComposing` is avoided due to
    // Safari not supporting it properly (although it's not needed in the first
    // place for Safari, just avoiding any possible issues).
    if (event.which === 229) {
      return;
    }

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!latestOpen() && event.currentTarget === floatingFocusEl()) {
      return;
    }

    if (nested() && isCrossOrientationCloseKey(event.key, orientation(), rtl(), isGrid())) {
      // If the nested list's close key is also the parent navigation key,
      // let the parent navigate. Otherwise, stop propagating the event.
      if (!isMainOrientationKey(event.key, getParentOrientation())) {
        stopEvent(event);
      }

      store.setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));

      const domReference = store.state.domReferenceElement;
      if (isHTMLElement(domReference)) {
        if (virtual()) {
          tree?.events.emit('virtualfocus', domReference);
        } else {
          domReference.focus();
        }
      }

      return;
    }

    const currentIndex = indexRef.current;
    const minIndex = getMinListIndex(props.listRef, disabledIndices());
    const maxIndex = getMaxListIndex(props.listRef, disabledIndices());

    if (!typeableComboboxReference()) {
      if (event.key === 'Home') {
        stopEvent(event);
        indexRef.current = minIndex;
        onNavigate(event);
      }

      if (event.key === 'End') {
        stopEvent(event);
        indexRef.current = maxIndex;
        onNavigate(event);
      }
    }

    // Grid navigation is injected by grid-capable consumers so non-grid
    // consumers (menu, select) tree-shake the grid helpers out.
    const navigateGrid = props.grid;
    if (navigateGrid != null) {
      const index = navigateGrid(
        event,
        indexRef.current,
        props.listRef,
        orientation(),
        loopFocus(),
        rtl(),
        disabledIndices(),
        minIndex,
        maxIndex,
      );

      if (index != null) {
        indexRef.current = index;
        onNavigate(event);
      }

      if (orientation() === 'both') {
        return;
      }
    }

    if (isMainOrientationKey(event.key, orientation())) {
      stopEvent(event);

      // Reset the index if no item is focused.
      if (
        latestOpen() &&
        !virtual() &&
        activeElement((event.currentTarget as Element).ownerDocument) === event.currentTarget
      ) {
        indexRef.current = isMainOrientationToEndKey(event.key, orientation(), rtl())
          ? minIndex
          : maxIndex;
        onNavigate(event);
        return;
      }

      if (isMainOrientationToEndKey(event.key, orientation(), rtl())) {
        if (loopFocus()) {
          if (currentIndex >= maxIndex) {
            if (allowEscape() && currentIndex !== props.listRef.current.length) {
              indexRef.current = -1;
            } else {
              // Give time for virtualizers to update the listRef.
              forceSyncFocusRef.current = false;
              indexRef.current = minIndex;
            }
          } else {
            indexRef.current = findNonDisabledListIndex(props.listRef.current, {
              startingIndex: currentIndex,
              disabledIndices: disabledIndices(),
            });
          }
        } else {
          indexRef.current = Math.min(
            maxIndex,
            findNonDisabledListIndex(props.listRef.current, {
              startingIndex: currentIndex,
              disabledIndices: disabledIndices(),
            }),
          );
        }
      } else if (loopFocus()) {
        if (currentIndex <= minIndex) {
          if (allowEscape() && currentIndex !== -1) {
            indexRef.current = props.listRef.current.length;
          } else {
            // Give time for virtualizers to update the listRef.
            forceSyncFocusRef.current = false;
            indexRef.current = maxIndex;
          }
        } else {
          indexRef.current = findNonDisabledListIndex(props.listRef.current, {
            startingIndex: currentIndex,
            decrement: true,
            disabledIndices: disabledIndices(),
          });
        }
      } else {
        indexRef.current = Math.max(
          minIndex,
          findNonDisabledListIndex(props.listRef.current, {
            startingIndex: currentIndex,
            decrement: true,
            disabledIndices: disabledIndices(),
          }),
        );
      }

      if (isIndexOutOfListBounds(props.listRef.current, indexRef.current)) {
        indexRef.current = -1;
      }

      onNavigate(event);
    }
  };

  const item: HTMLProps = {
    onFocus(event: FocusEvent) {
      forceSyncFocusRef.current = true;
      syncCurrentTarget(event);
    },
    onClick(event: MouseEvent) {
      (event.currentTarget as HTMLElement).focus({ preventScroll: true }); // Safari
    },
    onMouseMove(event: MouseEvent) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      forceSyncFocusRef.current = true;
      forceScrollIntoViewRef.current = false;
      if (focusItemOnHover()) {
        syncCurrentTarget(event);
      }
    },
    onPointerLeave(event: PointerEvent) {
      if (!latestOpen() || !isPointerModalityRef.current || event.pointerType === 'touch') {
        return;
      }

      forceSyncFocusRef.current = true;

      const relatedTarget = event.relatedTarget as HTMLElement | null;

      if (!focusItemOnHover() || props.listRef.current.includes(relatedTarget)) {
        return;
      }

      if (!resetOnPointerLeave()) {
        return;
      }

      cancelQueuedFocusRef.current?.();
      cancelQueuedFocusRef.current = null;

      indexRef.current = -1;
      onNavigate(event);

      if (!virtual()) {
        const floatingFocusElValue = floatingFocusEl();
        const activeEl = activeElement(ownerDocument(floatingFocusElValue));
        if (floatingFocusElValue && contains(floatingFocusElValue, activeEl)) {
          floatingFocusElValue.focus({ preventScroll: true });
        }
      }
    },
  };

  const ariaActiveDescendant = () =>
    virtual() && open() && hasActiveIndex() ? `${props.id}-${props.activeIndex}` : undefined;

  const floating: HTMLProps = {
    get 'aria-activedescendant'() {
      return typeableComboboxReference() ? undefined : ariaActiveDescendant();
    },
    onKeyDown(event: KeyboardEvent) {
      // Close submenu on Shift+Tab
      if (event.key === 'Tab' && event.shiftKey && latestOpen() && !virtual()) {
        // If the event originated from within a nested element (e.g., a Dialog opened from
        // within the menu), don't close the menu. The nested element has its own focus
        // management and should handle the Tab key.
        const target = getTarget(event) as Element | null;
        if (target && !contains(floatingFocusEl(), target)) {
          return;
        }

        stopEvent(event);
        store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));

        const domReference = store.state.domReferenceElement;
        if (isHTMLElement(domReference)) {
          domReference.focus();
        }

        return;
      }

      commonOnKeyDown(event);
    },
    onPointerMove(event: PointerEvent) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      isPointerModalityRef.current = true;
    },
  };

  function openOnNavigationKeyDown(event: KeyboardEvent) {
    store.setOpen(
      true,
      createChangeEventDetails(REASONS.listNavigation, event, event.currentTarget as HTMLElement),
    );
  }

  function checkVirtualMouse(event: MouseEvent) {
    if (focusItemOnOpen() === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenRef.current = !virtual();
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    // `pointerdown` fires first, reset the state then perform the checks.
    focusItemOnOpenRef.current = focusItemOnOpen();
    if (focusItemOnOpen() === 'auto' && isVirtualPointerEvent(event)) {
      focusItemOnOpenRef.current = true;
    }
  }

  const trigger: HTMLProps = {
    onKeyDown(event: KeyboardEvent) {
      // non-reactive open state
      const currentOpen = store.select('open');
      isPointerModalityRef.current = false;

      const isArrowKey = event.key.startsWith('Arrow');
      const isParentCrossOpenKey = isCrossOrientationOpenKey(
        event.key,
        getParentOrientation(),
        rtl(),
      );
      const isMainKey = isMainOrientationKey(event.key, orientation());
      const isNavigationKey =
        (nested() ? isParentCrossOpenKey : isMainKey) ||
        event.key === 'Enter' ||
        event.key.trim() === '';

      if (virtual() && currentOpen) {
        return commonOnKeyDown(event);
      }

      // If a floating element should not open on arrow key down, avoid
      // setting `activeIndex` while it's closed.
      if (!currentOpen && !openOnArrowKeyDown() && isArrowKey) {
        return undefined;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
        keyRef.current = nested() && isParentMainKey ? null : event.key;
      }

      if (nested()) {
        if (isParentCrossOpenKey) {
          stopEvent(event);

          if (currentOpen) {
            indexRef.current = getMinEnabledIndex();
            onNavigate(event);
          } else {
            openOnNavigationKeyDown(event);
          }
        }

        return undefined;
      }

      if (isMainKey) {
        if (selectedIndex() != null) {
          indexRef.current = selectedIndex()!;
        }

        stopEvent(event);

        if (!currentOpen && openOnArrowKeyDown()) {
          openOnNavigationKeyDown(event);
        } else {
          commonOnKeyDown(event);
        }

        if (currentOpen) {
          onNavigate(event);
        }
      }

      return undefined;
    },
    onFocus(event: FocusEvent) {
      if (store.select('open') && !virtual()) {
        indexRef.current = -1;
        onNavigate(event);
      }
    },
    onPointerDown: checkVirtualPointer,
    onPointerEnter: checkVirtualPointer,
    onMouseDown: checkVirtualMouse,
    onClick: checkVirtualMouse,
  };

  const reference: HTMLProps = {
    get 'aria-activedescendant'() {
      return ariaActiveDescendant();
    },
    ...trigger,
  };

  return {
    get reference() {
      return enabled() ? reference : undefined;
    },
    get floating() {
      return enabled() ? floating : undefined;
    },
    get item() {
      return enabled() ? item : undefined;
    },
    get trigger() {
      return enabled() ? trigger : undefined;
    },
  };
}
