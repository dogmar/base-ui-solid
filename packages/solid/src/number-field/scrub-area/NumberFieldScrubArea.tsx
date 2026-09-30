import { createEffect, createSignal, flush, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerWindow, ownerDocument } from '@base-ui/utils/owner';
import { platform } from '@base-ui/utils/platform';
import { getTarget } from '@base-ui/utils/shadowDom';
import { useTimeout } from '../../solid-utils/timers';
import { createRef } from '../../solid-utils/refs';
import type { BaseUIComponentProps } from '../../internals/types';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { NumberFieldScrubAreaContext } from './NumberFieldScrubAreaContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getViewportRect } from '../utils/getViewportRect';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

const SCRUB_AREA_STYLE: JSX.CSSProperties = {
  'touch-action': 'none',
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldScrubArea(componentProps: NumberFieldScrubArea.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'direction',
    'pixelSensitivity',
    'teleportDistance',
    'style',
    'ref',
  );

  const direction = () => componentProps.direction ?? 'horizontal';
  const pixelSensitivity = () => componentProps.pixelSensitivity ?? 2;

  const {
    state,
    setIsScrubbing: setRootScrubbing,
    inputRef,
    focusInput,
    incrementValue,
    allowInputSyncRef,
    getStepAmount,
    onValueCommitted,
    lastChangedValueRef,
    valueRef,
  } = useNumberFieldRootContext();

  const scrubAreaRef = createRef<HTMLSpanElement>();

  const isScrubbingRef = { current: false };
  const didMoveRef = { current: false };
  const pointerDownTargetRef = { current: null as EventTarget | null };
  const scrubAreaCursorRef = createRef<HTMLSpanElement>();
  const virtualCursorCoords = { current: { x: 0, y: 0 } };

  const exitPointerLockTimeout = useTimeout();

  const [isTouchInput, setIsTouchInput] = createSignal(false, { ownedWrite: true });
  const [isPointerLockDenied, setIsPointerLockDenied] = createSignal(false, { ownedWrite: true });
  const [isScrubbing, setIsScrubbing] = createSignal(false, { ownedWrite: true });

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  const onScrub = ({ movementX, movementY }: PointerEvent) => {
    const virtualCursor = scrubAreaCursorRef.current;
    const scrubAreaEl = scrubAreaRef.current;

    if (!virtualCursor || !scrubAreaEl) {
      return;
    }

    const rect = getViewportRect(
      untrack(() => componentProps.teleportDistance),
      scrubAreaEl,
    );

    const coords = virtualCursorCoords.current;

    // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
    const wrap = (coord: number, halfSize: number, low: number, high: number) => {
      if (coord + halfSize < low) {
        return high - halfSize;
      }
      if (coord + halfSize > high) {
        return low - halfSize;
      }
      return coord;
    };

    const newCoords = {
      x: wrap(
        Math.round(coords.x + movementX),
        virtualCursor.offsetWidth / 2,
        rect.left,
        rect.right,
      ),
      y: wrap(
        Math.round(coords.y + movementY),
        virtualCursor.offsetHeight / 2,
        rect.top,
        rect.bottom,
      ),
    };

    virtualCursorCoords.current = newCoords;

    updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
  };

  const onScrubbingChange = (scrubbingValue: boolean, { clientX, clientY }: PointerEvent) => {
    setIsScrubbing(scrubbingValue);
    setRootScrubbing(scrubbingValue);
    // React wraps these updates in `flushSync` so the virtual cursor mounts before it is
    // positioned; flush the queued signal writes for the same effect.
    flush();

    const virtualCursor = scrubAreaCursorRef.current;
    if (!virtualCursor || !scrubbingValue) {
      return;
    }

    const initialCoords = {
      x: clientX - virtualCursor.offsetWidth / 2,
      y: clientY - virtualCursor.offsetHeight / 2,
    };

    virtualCursorCoords.current = initialCoords;

    updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
  };

  createEffect(
    () => ({
      disabled: state.disabled,
      readOnly: state.readOnly,
      isScrubbing: isScrubbing(),
    }),
    function registerGlobalScrubbingEventListeners(deps) {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!inputRef.current || deps.disabled || deps.readOnly || !deps.isScrubbing) {
        return undefined;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent) {
        function handler() {
          try {
            ownerDocument(scrubAreaRef.current).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingRef.current = false;
            onScrubbingChange(false, event);
            onValueCommitted(
              lastChangedValueRef.current ?? valueRef.current,
              createGenericEventDetails(REASONS.scrub, event),
            );

            // Manually dispatch a click event if no movement happened, since
            // preventDefault on pointerdown prevents the browser click event.
            const pointerDownTarget = pointerDownTargetRef.current;
            const input = inputRef.current;
            if (!didMoveRef.current && pointerDownTarget != null && input) {
              pointerDownTarget.dispatchEvent(
                new (ownerWindow(input).MouseEvent)('click', {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            }

            didMoveRef.current = false;
            pointerDownTargetRef.current = null;
          }
        }

        if (platform.engine.gecko) {
          // Firefox needs a small delay here when soft-clicking as the pointer
          // lock will not release otherwise.
          exitPointerLockTimeout.start(20, handler);
        } else {
          handler();
        }
      }

      function handleScrubPointerMove(event: PointerEvent) {
        // The effects below can tear down and re-run without unmounting, which clears the ref
        // while `isScrubbing` stays `true` and re-attaches this listener. The ref is the source
        // of truth for whether a pointer is actually down.
        if (!isScrubbingRef.current) {
          return;
        }

        // Prevent text selection.
        event.preventDefault();

        onScrub(event);

        const { movementX, movementY } = event;

        cumulativeDelta += direction() === 'vertical' ? movementY : movementX;

        if (Math.abs(cumulativeDelta) >= pixelSensitivity()) {
          cumulativeDelta = 0;
          didMoveRef.current = true;
          const dValue = direction() === 'vertical' ? -movementY : movementX;
          const stepAmount = getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            allowInputSyncRef.current = true;
            incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            });
          }
        }
      }

      const win = ownerWindow(inputRef.current);
      const unsubscribe = mergeCleanups(
        addEventListener(win, 'pointerup', handleScrubPointerUp, true),
        addEventListener(win, 'pointermove', handleScrubPointerMove, true),
      );

      return () => {
        exitPointerLockTimeout.clear();
        unsubscribe();
      };
    },
  );

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingRef.current) {
      isScrubbingRef.current = false;
      setRootScrubbing(false);
      try {
        ownerDocument(scrubAreaRef.current).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing.
  createEffect(
    () => ({ disabled: state.disabled, readOnly: state.readOnly }),
    function registerScrubberTouchPreventListener(deps) {
      const element = scrubAreaRef.current;
      if (!element || deps.disabled || deps.readOnly) {
        return undefined;
      }

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      return addEventListener(element, 'touchstart', handleTouchStart);
    },
  );

  const defaultProps = {
    role: 'presentation',
    style: SCRUB_AREA_STYLE,
    async onPointerDown(event: PointerEvent) {
      const readOnly = untrack(() => state.readOnly);
      const disabled = untrack(() => state.disabled);
      if (event.defaultPrevented || readOnly || event.button || disabled) {
        return;
      }

      const isTouch = event.pointerType === 'touch';
      setIsTouchInput(isTouch);

      if (event.pointerType === 'mouse') {
        event.preventDefault();
        focusInput();
      }

      isScrubbingRef.current = true;
      didMoveRef.current = false;
      pointerDownTargetRef.current = getTarget(event);
      onScrubbingChange(true, event);

      // WebKit causes significant layout shift with the native message, so we can't use it.
      if (!isTouch && !platform.engine.webkit) {
        try {
          // Avoid non-deterministic errors in testing environments. This error sometimes
          // appears:
          // "The root document of this element is not valid for pointer lock."
          await ownerDocument(scrubAreaRef.current).body.requestPointerLock();
          setIsPointerLockDenied(false);
        } catch (error) {
          setIsPointerLockDenied(true);
        } finally {
          // `onScrubbingChange` already flushes its state updates, so re-emit the scrubbing
          // state directly to reflect the resolved pointer-lock result on the cursor.
          if (isScrubbingRef.current) {
            onScrubbingChange(true, event);
          }
        }
      }
    },
  };

  const contextValue: NumberFieldScrubAreaContext = {
    isScrubbing,
    isTouchInput,
    isPointerLockDenied,
    scrubAreaCursorRef,
  };

  return (
    <NumberFieldScrubAreaContext value={contextValue}>
      {useRenderElement('span', componentProps, {
        ref: [componentProps.ref, scrubAreaRef],
        state,
        props: [defaultProps, elementProps],
        stateAttributesMapping,
      })}
    </NumberFieldScrubAreaContext>
  );
}

export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubAreaState
> {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props = NumberFieldScrubAreaProps;
}
