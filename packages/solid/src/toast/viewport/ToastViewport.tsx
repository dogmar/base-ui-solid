import { createEffect, createMemo, omit, untrack, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils';
import { FocusGuard } from '../../utils/FocusGuard';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { isFocusVisible } from '../utils/focusVisible';
import { visuallyHidden } from '../../solid-utils/visuallyHidden';
import { useTimeout } from '../../solid-utils/timers';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as ToastViewportCssVars from './ToastViewportCssVars';

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastViewport(componentProps: ToastViewport.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'children',
    'ref',
  );

  const store = useToastProviderContext();
  const windowFocusTimeout = useTimeout();

  let handlingFocusGuard = false;
  let markedReadyForMouseLeave = false;
  let touchActive = false;

  const isEmpty = store.useState('isEmpty');
  const toasts = store.useState('toasts');
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');
  const prevFocusElement = store.useState('prevFocusElement');

  const hasTransitioningToasts = createMemo(() =>
    toasts().some((toast) => toast.transitionStatus === 'ending'),
  );
  const highPriorityToasts = createMemo(() => toasts().filter((toast) => toast.priority === 'high'));

  createEffect(
    () => isEmpty(),
    (empty) => {
      // `store.state.viewport` isn't available on the first render, since the portal node hasn't
      // yet been created. Depending on `isEmpty` ensures the listeners are attached once toasts
      // exist and the viewport ref is available.
      const viewport = store.state.viewport;
      if (!viewport || empty) {
        return undefined;
      }

      const win = ownerWindow(viewport);
      const doc = ownerDocument(viewport);

      // Listen globally for F6 so we can force-focus the viewport.
      function handleGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === 'F6' && getTarget(event) !== viewport) {
          event.preventDefault();
          store.set('prevFocusElement', activeElement(doc) as HTMLElement | null);
          viewport?.focus({ preventScroll: true });
          store.pauseTimers();
          store.set('focused', true);
        }
      }

      function handleWindowBlur(event: FocusEvent) {
        if (getTarget(event) !== win) {
          return;
        }

        store.set('isWindowFocused', false);
        store.pauseTimers();
      }

      function handleWindowFocus(event: FocusEvent) {
        if (event.relatedTarget) {
          return;
        }

        const target = getTarget(event);
        const activeEl = activeElement(ownerDocument(viewport));
        if (
          target === win ||
          !contains(viewport, target as HTMLElement | null) ||
          !isFocusVisible(activeEl)
        ) {
          store.resumeTimers();
        }

        // Wait for the `handleFocus` event to fire.
        windowFocusTimeout.start(0, () => store.set('isWindowFocused', true));
      }

      return mergeCleanups(
        addEventListener(win, 'keydown', handleGlobalKeyDown),
        addEventListener(win, 'blur', handleWindowBlur, true),
        addEventListener(win, 'focus', handleWindowFocus, true),
        addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true),
      );
    },
  );

  function handleFocusGuard(event: FocusEvent) {
    handlingFocusGuard = true;

    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    const firstFocusableToast =
      event.relatedTarget === store.state.viewport
        ? store.state.toasts.find(
            (toast) => toast.transitionStatus !== 'ending' && !toast.limited,
          )
        : undefined;

    if (firstFocusableToast) {
      firstFocusableToast.ref?.current?.focus();
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport) {
      event.preventDefault();
      // Restoring focus blurs the viewport, and `handleBlur` resumes the timers
      // from there. Resuming here as well would also fire when the previously
      // focused element lives inside the viewport, letting toasts dismiss out
      // from under the keyboard.
      store.restoreFocusToPrevElement();
    }
  }

  function flushMouseLeave() {
    const hasEndingToasts = store.state.toasts.some((toast) => toast.transitionStatus === 'ending');

    if (hasEndingToasts || touchActive || !markedReadyForMouseLeave) {
      return;
    }

    // Once transitions have finished, see if a mouseleave was already triggered
    // but blocked from taking effect. If so, we can now safely collapse the viewport
    // without restarting timers while the window is blurred.
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
    store.set('hovering', false);
    markedReadyForMouseLeave = false;
  }

  createEffect(
    () => hasTransitioningToasts(),
    () => {
      flushMouseLeave();
    },
  );

  function handleMouseEnter() {
    store.pauseTimers();
    store.set('hovering', true);
    markedReadyForMouseLeave = false;
  }

  function resumeTimersIfWindowFocused() {
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
  }

  function handleMouseLeave() {
    // Defer to `flushMouseLeave`: while toasts are transitioning out or a touch gesture is active
    // it records the intent and collapses later; otherwise it collapses immediately.
    markedReadyForMouseLeave = true;
    flushMouseLeave();
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touchActive = true;
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }

    touchActive = false;
    flushMouseLeave();
  }

  function handleFocus() {
    if (handlingFocusGuard) {
      handlingFocusGuard = false;
      return;
    }

    if (untrack(focused)) {
      return;
    }

    // Only set focused when the active element is focus-visible.
    // This prevents the viewport from staying expanded when clicking inside without
    // keyboard navigation.
    if (isFocusVisible(activeElement(ownerDocument(store.state.viewport)))) {
      store.set('focused', true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (
      !untrack(focused) ||
      contains(store.state.viewport, event.relatedTarget as HTMLElement | null)
    ) {
      return;
    }

    store.set('focused', false);
    resumeTimersIfWindowFocused();
  }

  const defaultProps: HTMLProps = {
    tabindex: -1,
    role: 'region',
    'aria-live': 'polite',
    'aria-atomic': 'false',
    'aria-relevant': 'additions text',
    'aria-label': 'Notifications',
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    // Solid's `onFocus`/`onBlur` attach the native non-bubbling events; these
    // handlers rely on catching descendant focus changes, so use focusin/focusout.
    onFocusIn: handleFocus,
    onFocusOut: handleBlur,
    onKeyDown: handleKeyDown,
    onClick: handleFocus,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    get style(): JSX.CSSProperties {
      const frontmostHeight = toasts()[0]?.height;
      return {
        [ToastViewportCssVars.frontmostHeight]: frontmostHeight
          ? `${frontmostHeight}px`
          : undefined,
      };
    },
  };

  const state: ToastViewportState = {
    get expanded() {
      return expanded();
    },
  };

  const showFocusGuards = () => !isEmpty() && prevFocusElement() !== null;

  const element = useRenderElement('div', componentProps, {
    ref: [componentProps.ref, store.setViewport],
    state,
    props: [
      defaultProps,
      elementProps,
      {
        // The getter is invoked exactly once by the engine's stable-children
        // path, so `componentProps.children` is resolved a single time here;
        // each array item then gets its own isolating memo, keeping the focus
        // guards' reactivity from re-creating the user's children.
        get children() {
          return [
            () => (
              <Show when={showFocusGuards()}>
                <FocusGuard onFocus={handleFocusGuard} />
              </Show>
            ),
            componentProps.children,
            () => (
              <Show when={showFocusGuards()}>
                <FocusGuard onFocus={handleFocusGuard} />
              </Show>
            ),
          ] as unknown as JSX.Element;
        },
      },
    ],
  });

  return (
    <IsolateChildren>
      <Show when={showFocusGuards()}>
        <FocusGuard onFocus={handleFocusGuard} />
      </Show>
      {element}
      <Show when={!focused() && highPriorityToasts().length > 0}>
        <div style={visuallyHidden}>
          <For each={highPriorityToasts()} keyed={(toast) => toast.id}>
            {(toast) => (
              <div role="alert" aria-atomic="true">
                <div>{toast().title}</div>
                <div>{toast().description}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </IsolateChildren>
  );
}

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportProps extends BaseUIComponentProps<'div', ToastViewportState> {}

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}
