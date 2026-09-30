import { Show, createEffect, createMemo, createRenderEffect, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { fastObjectShallowCompare } from '@base-ui/utils/fastObjectShallowCompare';
import { platform } from '@base-ui/utils/platform';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { FocusGuard } from '../../utils/FocusGuard';
import {
  activeElement,
  contains,
  getTarget,
  isTypeableCombobox,
  getFloatingFocusElement,
  isTypeableElement,
} from '../utils/element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../utils/event';
import {
  tabbable,
  focusable,
  isOutsideEvent,
  isTabbable,
  getNextTabbable,
  getPreviousTabbable,
  type FocusableElement,
} from '../utils/tabbable';
import { getNodeAncestors, getNodeChildren } from '../utils/nodes';
import { isElementVisible } from '../utils/composite';
import type { FloatingContext, FloatingRootContext } from '../types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from '../utils/createAttribute';
import { enqueueFocus } from '../utils/enqueueFocus';
import { markOthers } from '../utils/markOthers';
import { usePortalContext } from './FloatingPortal';
import { useFloatingTree } from './FloatingTree';
import { FloatingTreeStore } from './FloatingTreeStore';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { FloatingUIOpenChangeDetails } from '../../internals/types';
import { resolveRef } from '../../utils/resolveRef';
import { useAnimationFrame, useTimeout } from '../../solid-utils/timers';
import { applyRef, createRef, useMergedRefs, type RefObject } from '../../solid-utils/refs';

// TODO(types): mirrors `InteractionType` from `@base-ui/utils/useEnhancedClickHandler`,
// which is a React hook module the Solid port must not import.
type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';

function getEventType(event: Event, lastInteractionType?: InteractionType): InteractionType {
  const win = ownerWindow(getTarget(event));
  if (event instanceof win.KeyboardEvent) {
    return 'keyboard';
  }
  if (event instanceof win.FocusEvent) {
    // Focus events can be caused by a preceding pointer interaction (e.g., focusout on outside press).
    // Prefer the last known pointer type if provided, else treat as keyboard.
    return lastInteractionType || 'keyboard';
  }
  if ('pointerType' in event) {
    return ((event as PointerEvent).pointerType as InteractionType) || 'keyboard';
  }
  if ('touches' in event) {
    return 'touch';
  }
  if (event instanceof win.MouseEvent) {
    // onClick events may not contain pointer events, and will fall through to here
    return lastInteractionType || (event.detail === 0 ? 'keyboard' : 'mouse');
  }
  return '';
}

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
    return entry.deref()?.isConnected;
  });
}

function addPreviouslyFocusedElement(element: Element | null | undefined) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== 'body') {
    previouslyFocusedElements.push(new WeakRef(element));
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement() {
  clearDisconnectedPreviouslyFocusedElements();
  return previouslyFocusedElements[previouslyFocusedElements.length - 1]?.deref();
}

function getFirstTabbableElement(container: Element | null) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container)[0] || container;
}

function handleTabIndex(floatingFocusElement: HTMLElement) {
  if (
    floatingFocusElement.hasAttribute('tabindex') &&
    !floatingFocusElement.hasAttribute('data-tabindex')
  ) {
    return;
  }

  if (!floatingFocusElement.getAttribute('role')?.includes('dialog')) {
    return;
  }

  const focusableElements = focusable(floatingFocusElement);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute('data-tabindex') || '';
    return (
      isTabbable(element) ||
      (element.hasAttribute('data-tabindex') && !dataTabIndex.startsWith('-'))
    );
  });
  const tabIndex = floatingFocusElement.getAttribute('tabindex');

  if (tabbableContent.length === 0) {
    if (tabIndex !== '0') {
      floatingFocusElement.setAttribute('tabindex', '0');
      // Mark our own write so the externally-managed early-return above doesn't
      // mistake it for a user-authored `tabindex` and freeze management.
      floatingFocusElement.setAttribute('data-tabindex', '0');
    }
  } else if (
    tabIndex !== '-1' ||
    (floatingFocusElement.hasAttribute('data-tabindex') &&
      floatingFocusElement.getAttribute('data-tabindex') !== '-1')
  ) {
    floatingFocusElement.setAttribute('tabindex', '-1');
    floatingFocusElement.setAttribute('data-tabindex', '-1');
  }
}

export interface FloatingFocusManagerProps {
  children: JSX.Element;
  /**
   * The floating context returned from `useFloatingRootContext`.
   */
  context: FloatingRootContext | FloatingContext;
  /**
   * The interaction type used to open the floating element.
   */
  openInteractionType?: InteractionType | null | undefined;
  /**
   * Whether or not the focus manager should be disabled. Useful to delay focus
   * management until after a transition completes or some other conditional
   * state.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Determines the element to focus when the floating element is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or floating element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use default behavior, `null` to fallback to default behavior,
   *   or `false`/`undefined` to do nothing.
   * @default true
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement>
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the floating element is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (reference or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fallback to default behavior,
   *   or `false`/`undefined` to do nothing.
   * @default true
   */
  returnFocus?:
    | boolean
    | RefObject<HTMLElement>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines where focus should be restored if focus inside the floating element is lost
   * (such as due to the removal of the currently focused element from the DOM).
   *
   * - `true`: restore to the nearest tabbable element inside the floating tree (previous
   *   tabbable if possible, otherwise the last tabbable, then the floating element itself)
   * - `'popup'`: restore directly to the floating element (container) itself
   * - `false`: do not restore focus
   * @default false
   */
  restoreFocus?: boolean | 'popup' | undefined;
  /**
   * Determines if focus is “modal”, meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed. This includes
   * screen reader virtual cursors.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Determines whether `focusout` event listeners that control whether the
   * floating element should be closed if the focus moves outside of it are
   * attached to the reference and floating elements. This affects non-modal
   * focus management.
   * @default true
   */
  closeOnFocusOut?: boolean | undefined;
  /**
   * Overrides the element to focus when tabbing forward out of the floating element.
   */
  nextFocusableElement?: HTMLElement | RefObject<HTMLElement> | null | undefined;
  /**
   * Overrides the element to focus when tabbing backward out of the floating element.
   */
  previousFocusableElement?: HTMLElement | RefObject<HTMLElement> | null | undefined;
  /**
   * Ref to the focus guard preceding the floating element content.
   * Can be useful to focus the popup programmatically.
   */
  beforeContentFocusGuardRef?: RefObject<HTMLSpanElement> | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Additional elements that should be treated as part of the floating subtree
   * even if they are rendered outside the floating element itself.
   */
  getInsideElements?: (() => Array<Element | null | undefined>) | undefined;
}

/**
 * Provides focus management for the floating element.
 * @see https://floating-ui.com/docs/FloatingFocusManager
 * @internal
 */
export function FloatingFocusManager(props: FloatingFocusManagerProps): JSX.Element {
  const disabled = () => props.disabled ?? false;
  const modal = () => props.modal ?? true;
  const closeOnFocusOut = () => props.closeOnFocusOut ?? true;
  const restoreFocus = () => props.restoreFocus ?? false;
  // `''` only replaces `undefined`; an explicit `null` marks a programmatic open
  // and is intentionally preserved.
  const openInteractionType = () =>
    props.openInteractionType === undefined ? '' : props.openInteractionType;

  const store = untrack(() => {
    const context = props.context;
    return 'rootStore' in context ? context.rootStore : context;
  });

  const open = store.useState('open');
  const domReference = store.useState('domReferenceElement');
  const floating = store.useState('floatingElement');
  const { events, dataRef } = store.context;

  const getNodeId = () => dataRef.current.floatingContext?.nodeId();

  const ignoreInitialFocus = () => props.initialFocus === false;
  // A typeable combobox reference (e.g. input/textarea) with `initialFocus={false}`
  // has different focus semantics: focus is not trapped inside the floating element,
  // so in the modal case the guards are not rendered, but `aria-hidden` is still
  // applied to the outside nodes.
  const isUntrappedTypeableCombobox = () =>
    isTypeableCombobox(domReference()) && ignoreInitialFocus();

  const tree = useFloatingTree(untrack(() => props.externalTree));
  const portalContext = usePortalContext();

  const preventReturnFocusRef = { current: false };
  const isPointerDownRef = { current: false };
  const pointerDownOutsideRef = { current: false };
  const lastFocusedTabbableRef: { current: FocusableElement | null } = { current: null };
  const closeTypeRef: { current: InteractionType } = { current: '' };
  const lastInteractionTypeRef: { current: InteractionType } = { current: '' };

  const beforeGuardRef = createRef<HTMLSpanElement>();
  const afterGuardRef = createRef<HTMLSpanElement>();

  const mergedBeforeGuardRef = useMergedRefs<HTMLSpanElement>(
    beforeGuardRef,
    (el) => applyRef(props.beforeContentFocusGuardRef, el),
    portalContext?.beforeInsideRef,
  );
  const mergedAfterGuardRef = useMergedRefs<HTMLSpanElement>(
    afterGuardRef,
    portalContext?.afterInsideRef,
  );

  const blurTimeout = useTimeout();
  const pointerDownTimeout = useTimeout();
  const restoreFocusFrame = useAnimationFrame();

  const isInsidePortal = portalContext != null;
  const floatingFocusElement = createMemo(() => getFloatingFocusElement(floating()));

  const getTabbableContent = (container: Element | null = floatingFocusElement()) => {
    return container ? tabbable(container) : [];
  };

  const getResolvedInsideElements = () =>
    props.getInsideElements?.().filter((element): element is Element => element != null) ?? [];

  // Prevent Tab from escaping the modal when there are no tabbable elements.
  createEffect(
    () => ({
      disabled: disabled(),
      modal: modal(),
      floatingFocusElement: floatingFocusElement(),
      isUntrappedTypeableCombobox: isUntrappedTypeableCombobox(),
    }),
    (deps) => {
      if (deps.disabled || !deps.modal) {
        return undefined;
      }

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Tab') {
          // The focus guards have nothing to focus, so we need to stop the event.
          if (
            contains(
              deps.floatingFocusElement,
              activeElement(ownerDocument(deps.floatingFocusElement)),
            ) &&
            getTabbableContent(deps.floatingFocusElement).length === 0 &&
            !deps.isUntrappedTypeableCombobox
          ) {
            stopEvent(event);
          }
        }
      }

      const doc = ownerDocument(deps.floatingFocusElement);
      return addEventListener(doc, 'keydown', onKeyDown);
    },
  );

  // Track pointer/keyboard interactions to disambiguate focus and outside presses.
  createEffect(
    () => ({
      disabled: disabled(),
      open: open(),
      floating: floating(),
      domReference: domReference(),
      floatingFocusElement: floatingFocusElement(),
    }),
    (deps) => {
      if (deps.disabled || !deps.open) {
        return undefined;
      }

      const doc = ownerDocument(deps.floatingFocusElement);

      function clearPointerDownOutside() {
        pointerDownOutsideRef.current = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const pointerTargetInside =
          contains(deps.floating, target) ||
          contains(deps.domReference, target) ||
          contains(portalContext?.portalNode(), target) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutsideRef.current = !pointerTargetInside;
        lastInteractionTypeRef.current = (event.pointerType as InteractionType) || 'keyboard';

        if (target?.closest(`[${CLICK_TRIGGER_IDENTIFIER}]`)) {
          isPointerDownRef.current = true;
          // Reset on the next tick so a single click on a click-trigger doesn't
          // permanently suppress focus-out closing for the lifetime of the instance.
          pointerDownTimeout.start(0, () => {
            isPointerDownRef.current = false;
          });
        }
      }

      function onKeyDown() {
        lastInteractionTypeRef.current = 'keyboard';
      }

      return mergeCleanups(
        addEventListener(doc, 'pointerdown', onPointerDown, true),
        addEventListener(doc, 'pointerup', clearPointerDownOutside, true),
        addEventListener(doc, 'pointercancel', clearPointerDownOutside, true),
        addEventListener(doc, 'keydown', onKeyDown, true),
        // Avoid a stale `true` leaking into the next open (e.g. keep-mounted popups)
        // if the popup dismissed between pointerdown and pointerup.
        clearPointerDownOutside,
      );
    },
  );

  // Close on focus out and restore focus within the floating tree when needed.
  createEffect(
    () => ({
      disabled: disabled(),
      closeOnFocusOut: closeOnFocusOut(),
      modal: modal(),
      restoreFocus: restoreFocus(),
      isUntrappedTypeableCombobox: isUntrappedTypeableCombobox(),
      domReference: domReference(),
      floating: floating(),
      floatingFocusElement: floatingFocusElement(),
    }),
    (deps) => {
      if (deps.disabled || !deps.closeOnFocusOut) {
        return undefined;
      }

      const doc = ownerDocument(deps.floatingFocusElement);

      // In Safari, buttons lose focus when pressing them.
      function handlePointerDown() {
        isPointerDownRef.current = true;
        pointerDownTimeout.start(0, () => {
          isPointerDownRef.current = false;
        });
      }

      function handleFocusIn(event: FocusEvent) {
        const target = getTarget(event) as FocusableElement | null;
        if (isTabbable(target)) {
          lastFocusedTabbableRef.current = target;
        }
      }

      function handleFocusOutside(event: FocusEvent) {
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        const currentTarget = event.currentTarget;
        const target = getTarget(event) as HTMLElement | null;

        // When focus is lost to the body (e.g. on a backdrop press), record the element that
        // had focus so a confirmation dialog opened while the body is focused can return focus
        // to it. Scoped to `modal` to avoid non-modal popups polluting the shared stack.
        if (
          deps.modal &&
          relatedTarget == null &&
          target != null &&
          contains(deps.floating, target)
        ) {
          addPreviouslyFocusedElement(target);
        }

        queueMicrotask(() => {
          const nodeId = getNodeId();
          const triggers = store.context.triggerElements;
          const insideElements = getResolvedInsideElements();
          const isRelatedFocusGuard =
            relatedTarget?.hasAttribute(createAttribute('focus-guard')) &&
            [
              beforeGuardRef.current,
              afterGuardRef.current,
              portalContext?.beforeInsideRef.current,
              portalContext?.afterInsideRef.current,
              portalContext?.beforeOutsideRef.current,
              portalContext?.afterOutsideRef.current,
              resolveRef(props.previousFocusableElement),
              resolveRef(props.nextFocusableElement),
            ].includes(relatedTarget);

          const movedToUnrelatedNode = !(
            contains(deps.domReference, relatedTarget) ||
            contains(deps.floating, relatedTarget) ||
            contains(relatedTarget, deps.floating) ||
            contains(portalContext?.portalNode(), relatedTarget) ||
            insideElements.some(
              (element) => element === relatedTarget || contains(element, relatedTarget),
            ) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) ||
            isRelatedFocusGuard ||
            (tree &&
              (getNodeChildren(tree.nodesRef.current, nodeId).find(
                (node) =>
                  contains(node.context?.elements.floating() ?? null, relatedTarget) ||
                  contains(node.context?.elements.domReference() ?? null, relatedTarget),
              ) ||
                getNodeAncestors(tree.nodesRef.current, nodeId).find((node) => {
                  const nodeFloating = node.context?.elements.floating() ?? null;
                  return (
                    [nodeFloating, getFloatingFocusElement(nodeFloating)].includes(
                      relatedTarget,
                    ) || node.context?.elements.domReference() === relatedTarget
                  );
                })))
          );

          if (currentTarget === deps.domReference && deps.floatingFocusElement) {
            handleTabIndex(deps.floatingFocusElement);
          }

          // Restore focus to the previously focused tabbable element to prevent
          // focus from being lost outside the floating tree.
          if (
            deps.restoreFocus &&
            currentTarget !== deps.domReference &&
            !isElementVisible(target) &&
            activeElement(doc) === doc.body
          ) {
            // Let the `FloatingPortal` effect know that focus is still inside the
            // floating tree.
            if (isHTMLElement(deps.floatingFocusElement)) {
              const floatingFocusEl = deps.floatingFocusElement;
              floatingFocusEl.focus();
              // If explicitly requested to restore focus to the popup container, do not search
              // for the next/previous tabbable element.
              if (deps.restoreFocus === 'popup') {
                // If the focused element is removed on pointerdown, the browser
                // tries to move focus to it right after the `.focus()` call above,
                // but because it's removed in the same tick, focus is lost instead.
                // Re-focusing asynchronously (next frame) wins that race.
                restoreFocusFrame.request(() => {
                  floatingFocusEl.focus();
                });
                return;
              }
            }

            const tabbableContent = getTabbableContent(
              deps.floatingFocusElement,
            ) as Array<Element | null>;
            const prevTabbable = lastFocusedTabbableRef.current;
            const nodeToFocus =
              (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ||
              tabbableContent[tabbableContent.length - 1] ||
              deps.floatingFocusElement;

            if (isHTMLElement(nodeToFocus)) {
              nodeToFocus.focus();
            }
          }

          // https://github.com/floating-ui/floating-ui/issues/3060
          if (dataRef.current.insideReactTree) {
            dataRef.current.insideReactTree = false;
            return;
          }

          // Focus did not move inside the floating tree, and there are no tabbable
          // portal guards to handle closing.
          if (
            (deps.isUntrappedTypeableCombobox ? true : !deps.modal) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDownRef.current &&
            // For an "untrapped" typeable combobox (input role=combobox with
            // initialFocus=false), re-opening the popup and tabbing out should still close it even
            // when the previously focused element (e.g. the next tabbable outside the popup) is
            // focused again. Otherwise, the popup remains open on the second Tab sequence:
            // click input -> Tab (closes) -> click input -> Tab.
            // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
            (deps.isUntrappedTypeableCombobox ||
              relatedTarget !== getPreviouslyFocusedElement())
          ) {
            preventReturnFocusRef.current = true;
            store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
          }
        });
      }

      function markInsideReactTree() {
        if (pointerDownOutsideRef.current) {
          return;
        }
        dataRef.current.insideReactTree = true;
        blurTimeout.start(0, () => {
          dataRef.current.insideReactTree = false;
        });
      }

      const domReferenceElement = isHTMLElement(deps.domReference) ? deps.domReference : null;
      if (!deps.floating && !domReferenceElement) {
        return undefined;
      }

      return mergeCleanups(
        domReferenceElement && addEventListener(domReferenceElement, 'focusout', handleFocusOutside),
        domReferenceElement &&
          addEventListener(domReferenceElement, 'pointerdown', handlePointerDown),
        deps.floating && addEventListener(deps.floating, 'focusin', handleFocusIn),
        deps.floating && addEventListener(deps.floating, 'focusout', handleFocusOutside),
        deps.floating &&
          portalContext &&
          addEventListener(deps.floating, 'focusout', markInsideReactTree, true),
      );
    },
  );

  // Hide everything outside the floating tree from assistive tech while open.
  createEffect(
    () => ({
      open: open(),
      disabled: disabled(),
      domReference: domReference(),
      floating: floating(),
      modal: modal(),
      isUntrappedTypeableCombobox: isUntrappedTypeableCombobox(),
    }),
    (deps) => {
      if (deps.disabled || !deps.floating || !deps.open) {
        return undefined;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(
        portalContext?.portalNode()?.querySelectorAll(`[${createAttribute('portal')}]`) || [],
      );

      const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
      const rootAncestorComboboxDomReference = ancestors
        .find((node) => isTypeableCombobox(node.context?.elements.domReference() || null))
        ?.context?.elements.domReference();

      const controlInsideElements = [
        deps.floating,
        ...portalNodes,
        beforeGuardRef.current,
        afterGuardRef.current,
        portalContext?.beforeOutsideRef.current,
        portalContext?.afterOutsideRef.current,
        ...getResolvedInsideElements(),
      ];
      const insideElements = [
        ...controlInsideElements,
        rootAncestorComboboxDomReference,
        resolveRef(props.previousFocusableElement),
        resolveRef(props.nextFocusableElement),
        deps.isUntrappedTypeableCombobox ? deps.domReference : null,
      ].filter((x): x is Element => x != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: deps.modal || deps.isUntrappedTypeableCombobox,
        mark: false,
      });

      const markerInsideElements = [deps.floating, ...portalNodes].filter(
        (x): x is Element => x != null,
      );
      const markerCleanup = markOthers(markerInsideElements);

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  // Focus the initial element when the floating element opens.
  const initialFocusDeps = createMemo(
    () => ({
      disabled: disabled(),
      open: open(),
      floatingFocusElement: floatingFocusElement(),
    }),
    { equals: fastObjectShallowCompare },
  );
  createRenderEffect(initialFocusDeps, (deps) => {
    if (!deps.open || deps.disabled || !isHTMLElement(deps.floatingFocusElement)) {
      return;
    }

    closeTypeRef.current = '';
    lastInteractionTypeRef.current = '';

    const floatingFocusEl = deps.floatingFocusElement;
    const doc = ownerDocument(floatingFocusEl);
    const previouslyFocusedElement = activeElement(doc);

    // Wait for any layout effect state setters to execute to set `tabIndex`.
    queueMicrotask(() => {
      const initialFocusValueOrFn = props.initialFocus ?? true;
      const resolvedInitialFocus =
        typeof initialFocusValueOrFn === 'function'
          ? initialFocusValueOrFn(openInteractionType() || '')
          : initialFocusValueOrFn;

      // `null` should fallback to default behavior in case of an empty ref.
      if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
        return;
      }

      const focusAlreadyInsideFloatingEl = contains(floatingFocusEl, previouslyFocusedElement);

      if (focusAlreadyInsideFloatingEl) {
        return;
      }

      let focusableElements: Array<FocusableElement> | null = null;
      const getDefaultFocusElement = () => {
        if (focusableElements == null) {
          focusableElements = getTabbableContent(floatingFocusEl);
        }

        return focusableElements[0] || floatingFocusEl;
      };

      let elToFocus: FocusableElement | null | undefined;
      if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
        elToFocus = getDefaultFocusElement();
      } else {
        elToFocus = resolveRef(resolvedInitialFocus);
      }
      elToFocus = elToFocus || getDefaultFocusElement();

      const hadFocusInside = contains(floatingFocusEl, activeElement(doc));

      // enqueueFocus returns a rAF-cancel function; we intentionally don't cancel this focus.
      void enqueueFocus(elToFocus, {
        preventScroll: elToFocus === floatingFocusEl,
        shouldFocus() {
          // This focus is queued on the next animation frame. If the floating element has closed
          // before it runs — e.g. tabbing out of a kept-mounted popup — don't pull focus back
          // onto the initial element after it has legitimately moved elsewhere.
          if (!store.state.open) {
            return false;
          }

          if (hadFocusInside) {
            return true;
          }

          const currentActiveElement = activeElement(doc);
          const focusMovedInside =
            currentActiveElement !== elToFocus && contains(floatingFocusEl, currentActiveElement);

          return !focusMovedInside;
        },
      });
    });
  });

  // Track return focus targets and restore focus on unmount/close.
  const returnFocusDeps = createMemo(
    () => ({
      disabled: disabled(),
      floating: floating(),
      floatingFocusElement: floatingFocusElement(),
      domReference: domReference(),
    }),
    { equals: fastObjectShallowCompare },
  );
  createRenderEffect(returnFocusDeps, (deps) => {
    if (deps.disabled || !deps.floatingFocusElement) {
      return undefined;
    }

    const floatingEl = deps.floating;
    const floatingFocusEl = deps.floatingFocusElement;
    const domReferenceEl = deps.domReference;

    const doc = ownerDocument(floatingFocusEl);
    const elementFocusedBeforeOpen = activeElement(doc);
    // Only an explicit `null` interaction type represents a programmatic open.
    // `undefined` is normalized to `''` by the prop default, so it never reaches
    // here as nullish and is intentionally not treated as programmatic.
    const preferPreviousFocus = openInteractionType() == null;

    addPreviouslyFocusedElement(elementFocusedBeforeOpen);

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (!details.open) {
        closeTypeRef.current = getEventType(details.nativeEvent, lastInteractionTypeRef.current);
      }

      if (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave') {
        preventReturnFocusRef.current = true;
      }

      if (details.reason !== REASONS.outsidePress) {
        return;
      }

      if (details.nested) {
        preventReturnFocusRef.current = false;
      } else if (
        isVirtualClick(details.nativeEvent as MouseEvent) ||
        isVirtualPointerEvent(details.nativeEvent as PointerEvent)
      ) {
        preventReturnFocusRef.current = false;
      } else {
        // On outside press, only return focus to the reference when the browser supports the
        // `focus({ preventScroll })` option; without it, restoring focus scrolls the page.
        // Chrome on Android and Samsung Internet still don't support `preventScroll`
        // (https://issues.chromium.org/issues/41453122), so the runtime check keeps return
        // focus disabled there to avoid the scroll jump.
        let isPreventScrollSupported = false;
        ownerDocument(floatingFocusEl)
          .createElement('div')
          .focus({
            get preventScroll() {
              isPreventScrollSupported = true;
              return false;
            },
          });

        if (isPreventScrollSupported) {
          preventReturnFocusRef.current = false;
        } else {
          preventReturnFocusRef.current = true;
        }
      }
    }

    events.on('openchange', onOpenChangeLocal);

    function getReturnElement(closeType: InteractionType) {
      const returnFocusValueOrFn = props.returnFocus ?? true;
      let resolvedReturnFocusValue =
        typeof returnFocusValueOrFn === 'function'
          ? returnFocusValueOrFn(closeType)
          : returnFocusValueOrFn;

      // `null` should fallback to default behavior in case of an empty ref.
      if (resolvedReturnFocusValue === undefined || resolvedReturnFocusValue === false) {
        return null;
      }

      if (resolvedReturnFocusValue === null) {
        resolvedReturnFocusValue = true;
      }

      const referenceReturnElement = domReferenceEl?.isConnected ? domReferenceEl : null;
      const previousReturnElement =
        elementFocusedBeforeOpen?.isConnected && getNodeName(elementFocusedBeforeOpen) !== 'body'
          ? elementFocusedBeforeOpen
          : null;

      let defaultReturnElement = preferPreviousFocus
        ? previousReturnElement || referenceReturnElement
        : referenceReturnElement || previousReturnElement;

      if (!defaultReturnElement) {
        defaultReturnElement = getPreviouslyFocusedElement() || null;
      }

      if (typeof resolvedReturnFocusValue === 'boolean') {
        return defaultReturnElement;
      }

      return resolveRef(resolvedReturnFocusValue) || defaultReturnElement || null;
    }

    return () => {
      events.off('openchange', onOpenChangeLocal);

      const activeEl = activeElement(doc);
      const insideElements = getResolvedInsideElements();
      const isFocusInsideFloatingTree =
        contains(floatingEl, activeEl) ||
        insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
        (tree &&
          getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) =>
            contains(node.context?.elements.floating() ?? null, activeEl),
          ));

      const returnFocusValueOrFn = props.returnFocus ?? true;
      const closeType = closeTypeRef.current;
      const returnElement = getReturnElement(closeType);

      queueMicrotask(() => {
        // `returnElement` if it is tabbable, otherwise its first tabbable child,
        // otherwise `returnElement` itself (which may not be tabbable at all).
        const tabbableReturnElement = getFirstTabbableElement(returnElement);
        const hasExplicitReturnFocus = typeof returnFocusValueOrFn !== 'boolean';

        if (
          returnFocusValueOrFn &&
          !preventReturnFocusRef.current &&
          isHTMLElement(tabbableReturnElement) &&
          // If the focus moved somewhere else after mount, avoid returning focus
          // since it likely entered a different element which should be
          // respected: https://github.com/floating-ui/floating-ui/issues/2607
          (!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body
            ? isFocusInsideFloatingTree
            : true)
        ) {
          // TODO(types): the local TS lib's `FocusOptions` lacks `focusVisible`
          // (https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus#focusvisible).
          const focusOptions: FocusOptions & { focusVisible?: boolean | undefined } = {
            preventScroll: true,
          };
          if (closeType === 'keyboard') {
            focusOptions.focusVisible = true;
          }
          tabbableReturnElement.focus(focusOptions);
        }

        preventReturnFocusRef.current = false;
      });
    };
  });

  // Safari may randomly scroll to the bottom of the page if an input inside a popup has focus
  // when the popup unmounts from the DOM.
  // By blurring it before the popup unmounts, we can prevent this behavior.
  createRenderEffect(
    () => ({ open: open(), floating: floating() }),
    (deps) => {
      if (!platform.engine.webkit || deps.open || !deps.floating) {
        return;
      }

      const activeEl = activeElement(ownerDocument(deps.floating));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(deps.floating, activeEl)) {
        activeEl.blur();
      }
    },
  );

  // Synchronize the focus manager state (modal, closeOnFocusOut, open, etc.) to the
  // FloatingPortal context, which uses it to decide whether to render its own guards.
  // Guarded with a last-synced flag and released from `onCleanup` (rather than a
  // per-apply cleanup) so re-applies with unchanged values don't oscillate.
  let focusManagerStateSynced = false;
  createRenderEffect(
    () => ({
      disabled: disabled(),
      modal: modal(),
      open: open(),
      closeOnFocusOut: closeOnFocusOut(),
      domReference: domReference(),
    }),
    (deps) => {
      if (!portalContext) {
        return;
      }

      if (deps.disabled) {
        if (focusManagerStateSynced) {
          portalContext.setFocusManagerState(null);
          focusManagerStateSynced = false;
        }
        return;
      }

      portalContext.setFocusManagerState({
        modal: deps.modal,
        closeOnFocusOut: deps.closeOnFocusOut,
        open: deps.open,
        onOpenChange: store.setOpen,
        domReference: deps.domReference,
      });
      focusManagerStateSynced = true;
    },
  );
  onCleanup(() => {
    if (focusManagerStateSynced) {
      portalContext?.setFocusManagerState(null);
      focusManagerStateSynced = false;
    }
  });

  // Keep the floating element tabIndex in sync and clear stale focus records.
  createRenderEffect(
    () => ({ disabled: disabled(), floatingFocusElement: floatingFocusElement() }),
    (deps) => {
      if (deps.disabled || !deps.floatingFocusElement) {
        return undefined;
      }
      handleTabIndex(deps.floatingFocusElement);
      return () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  const shouldRenderGuards = () =>
    !disabled() && (modal() ? !isUntrappedTypeableCombobox() : true) && (isInsidePortal || modal());

  return (
    <>
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={mergedBeforeGuardRef}
          onFocus={(event: FocusEvent) => {
            if (modal()) {
              const els = getTabbableContent();
              // enqueueFocus returns a rAF-cancel function we don't need here.
              void enqueueFocus(els[els.length - 1]);
            } else {
              const portalNode = portalContext?.portalNode();
              if (portalNode) {
                preventReturnFocusRef.current = false;
                if (isOutsideEvent(event, portalNode)) {
                  const nextTabbable = getNextTabbable(domReference());
                  nextTabbable?.focus();
                } else {
                  resolveRef(
                    props.previousFocusableElement ?? portalContext?.beforeOutsideRef,
                  )?.focus();
                }
              }
            }
          }}
        />
      </Show>
      {props.children}
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={mergedAfterGuardRef}
          onFocus={(event: FocusEvent) => {
            if (modal()) {
              // enqueueFocus returns a rAF-cancel function we don't need here.
              void enqueueFocus(getTabbableContent()[0]);
            } else {
              const portalNode = portalContext?.portalNode();
              if (portalNode) {
                if (closeOnFocusOut()) {
                  preventReturnFocusRef.current = true;
                }

                if (isOutsideEvent(event, portalNode)) {
                  const prevTabbable = getPreviousTabbable(domReference());
                  prevTabbable?.focus();
                } else {
                  resolveRef(
                    props.nextFocusableElement ?? portalContext?.afterOutsideRef,
                  )?.focus();
                }
              }
            }
          }}
        />
      </Show>
    </>
  );
}
