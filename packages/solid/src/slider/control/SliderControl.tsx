import { createEffect, createRenderEffect, omit, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { useAnimationFrame } from '../../solid-utils/timers';
import { createRef } from '../../solid-utils/refs';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils/element';
import type { Coords } from '../../floating-ui-react/types';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';
import { getMidpoint } from '../utils/getMidpoint';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start:
      parseSize(styles[`border${start}Width` as keyof CSSStyleDeclaration] as string) +
      parseSize(styles[`padding${start}` as keyof CSSStyleDeclaration] as string),
    end:
      parseSize(styles[`border${end}Width` as keyof CSSStyleDeclaration] as string) +
      parseSize(styles[`padding${end}` as keyof CSSStyleDeclaration] as string),
  };
}

function getFingerCoords(
  event: TouchEvent | PointerEvent,
  touchIdRef: { current: number | null },
): Coords | null {
  // The event is TouchEvent
  if (touchIdRef.current != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderControl(componentProps: SliderControl.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const {
    disabled,
    dragging,
    inset,
    lastChangeReasonRef,
    max,
    min,
    minStepsBetweenValues,
    onValueCommitted,
    orientation,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    pressedValuesRef,
    registerFieldControlRef,
    renderBeforeHydration,
    setActive,
    setDragging,
    setValue,
    state,
    step,
    thumbCollisionBehavior,
    thumbRefs,
    values,
  } = useSliderRootContext();

  const direction = useDirection();
  const range = () => values().length > 1;
  const vertical = () => orientation() === 'vertical';

  const controlRef = createRef<HTMLElement>();
  const stylesRef = createRef<CSSStyleDeclaration>();
  const setStylesRef = (element: HTMLElement | null) => {
    if (element && stylesRef.current == null) {
      stylesRef.current = ownerWindow(element).getComputedStyle(element);
    }
  };

  // A number that uniquely identifies the current finger in the touch session.
  const touchIdRef: { current: number | null } = { current: null };
  // The number of touch/pointermove events that have fired.
  const moveCountRef = { current: 0 };
  // The offset amount to each side of the control for inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  const insetThumbOffsetRef = { current: 0 };
  const currentInteractionValueRef: { current: number | number[] | null } = { current: null };
  // Mirrors React's `useValueAsRef(values)`: kept in sync with the latest
  // rendered values, and overwritten synchronously during drag interactions.
  const latestValuesRef: { current: readonly number[] } = { current: untrack(values) };
  createRenderEffect(
    () => values(),
    (currentValues) => {
      latestValuesRef.current = currentValues;
    },
  );

  function getThumbInput(el: Element | null | undefined) {
    return el?.querySelector<HTMLInputElement>('input[type="range"]');
  }

  function updatePressedThumb(nextIndex: number) {
    pressedThumbIndexRef.current = nextIndex;
    if (!thumbRefs.current[nextIndex]) {
      pressedThumbCenterOffsetRef.current = null;
    }
  }

  function resetPressedThumb() {
    pressedThumbIndexRef.current = -1;
    pressedThumbCenterOffsetRef.current = null;
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return thumbRefs.current.some((thumbEl) => {
      if (!isElement(thumbEl) || !contains(thumbEl, target as Element)) {
        return false;
      }

      return getThumbInput(thumbEl)?.disabled === true;
    });
  }

  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlRef.current;
    const thumbIndex = pressedThumbIndexRef.current;
    const currentValues = untrack(values);

    if (!control || thumbIndex < 0 || thumbIndex >= currentValues.length) {
      if (thumbIndex >= currentValues.length) {
        currentInteractionValueRef.current = null;
      }
      return null;
    }

    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const isVertical = untrack(vertical);
    const controlOffset = getControlOffset(stylesRef.current, isVertical);
    const insetThumbOffset = insetThumbOffsetRef.current;
    const controlSize =
      (isVertical ? height : width) -
      controlOffset.start -
      controlOffset.end -
      insetThumbOffset * 2;
    const thumbCenterOffset = pressedThumbCenterOffsetRef.current ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = isVertical
      ? bottom - fingerY - controlOffset.end
      : (untrack(direction) === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

    const currentMin = untrack(min);
    const currentMax = untrack(max);
    const currentStep = untrack(step);

    let newValue = (currentMax - currentMin) * valueRescaled + currentMin;
    newValue = roundValueToStep(newValue, currentStep, currentMin);
    newValue = clamp(newValue, currentMin, currentMax);

    if (!untrack(range)) {
      return {
        value: newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    return resolveThumbCollision(
      untrack(thumbCollisionBehavior),
      currentValues,
      latestValuesRef.current,
      pressedValuesRef.current,
      thumbIndex,
      newValue,
      currentMin,
      currentMax,
      currentStep,
      untrack(minStepsBetweenValues),
    );
  }

  function startPressing(fingerCoords: Coords) {
    const currentValues = untrack(values);
    pressedValuesRef.current = untrack(range) ? currentValues.slice() : null;
    currentInteractionValueRef.current = null;
    latestValuesRef.current = currentValues;

    const pressedThumbIndex = pressedThumbIndexRef.current;
    let closestThumbIndex = pressedThumbIndex;

    if (pressedThumbIndex > -1 && pressedThumbIndex < currentValues.length) {
      if (currentValues[pressedThumbIndex] === untrack(max)) {
        let candidateIndex = pressedThumbIndex;

        while (candidateIndex > 0 && currentValues[candidateIndex - 1] === untrack(max)) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !untrack(vertical) ? 'x' : 'y';
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      for (let i = 0; i < thumbRefs.current.length; i += 1) {
        const thumbEl = thumbRefs.current[i];
        if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
          const midpoint = getMidpoint(thumbEl, untrack(vertical));
          const distance = Math.abs(fingerCoords[axis] - midpoint);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (untrack(inset)) {
      const thumbEl = thumbRefs.current[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !untrack(vertical) ? 'width' : 'height';
        insetThumbOffsetRef.current = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input = getThumbInput(thumbRefs.current?.[thumbIndex]);
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    } as FocusOptions);
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValueRef.current = finger.value;
      latestValuesRef.current = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track and focus the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
        focusThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  const handleTouchMove = (nativeEvent: TouchEvent | PointerEvent) => {
    const fingerCoords = getFingerCoords(nativeEvent, touchIdRef);

    if (fingerCoords == null) {
      return;
    }

    moveCountRef.current += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, untrack(step), untrack(minStepsBetweenValues))) {
      if (!untrack(dragging) && moveCountRef.current > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        setDragging(true);
      }

      setValueFromPointer(finger, REASONS.drag, nativeEvent);
    }
  };

  const handleTouchEnd = (nativeEvent: TouchEvent | PointerEvent) => {
    setActive(-1);
    setDragging(false);

    pressedThumbCenterOffsetRef.current = null;

    // If the value array shrank or grew mid-drag, the cached interaction value no longer
    // matches the current thumbs (the pressed index can still be in range), so dropping it
    // keeps a stale or malformed array from being committed on release.
    const interactionValue = currentInteractionValueRef.current;
    if (Array.isArray(interactionValue) && interactionValue.length !== untrack(values).length) {
      currentInteractionValueRef.current = null;
    }

    if (currentInteractionValueRef.current != null) {
      const commitReason = lastChangeReasonRef.current;
      onValueCommitted(
        currentInteractionValueRef.current,
        createGenericEventDetails(commitReason, nativeEvent),
      );
    }

    if (
      'pointerType' in nativeEvent &&
      typeof controlRef.current?.hasPointerCapture === 'function' &&
      controlRef.current.hasPointerCapture((nativeEvent as PointerEvent).pointerId)
    ) {
      controlRef.current?.releasePointerCapture((nativeEvent as PointerEvent).pointerId);
    }

    pressedThumbIndexRef.current = -1;
    touchIdRef.current = null;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    stopListening();
  };

  const handleTouchStart = (nativeEvent: TouchEvent) => {
    if (untrack(disabled)) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];
    if (touch == null) {
      return;
    }

    touchIdRef.current = touch.identifier;

    const fingerCoords = { x: touch.clientX, y: touch.clientY };
    startPressing(fingerCoords);

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    focusThumb(finger.thumbIndex);
    setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

    moveCountRef.current = 0;
    const doc = ownerDocument(controlRef.current);
    doc.addEventListener('touchmove', handleTouchMove, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
  };

  const stopListening = () => {
    const doc = ownerDocument(controlRef.current);
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    pressedValuesRef.current = null;
    currentInteractionValueRef.current = null;
  };

  const focusFrame = useAnimationFrame();

  onSettled(() => {
    const control = controlRef.current;
    if (!control) {
      return () => stopListening();
    }

    const unsubscribeTouchStart = addEventListener(control, 'touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      unsubscribeTouchStart();
      focusFrame.cancel();

      stopListening();
    };
  });

  createEffect(
    () => disabled(),
    (isDisabled) => {
      if (isDisabled) {
        stopListening();
      }
    },
  );

  return useRenderElement('div', componentProps, {
    state,
    ref: [componentProps.ref, registerFieldControlRef, controlRef, setStylesRef],
    props: [
      {
        get ['data-base-ui-slider-control']() {
          return renderBeforeHydration() ? '' : undefined;
        },
        onPointerDown(event: PointerEvent) {
          const control = controlRef.current;
          const target = getTarget(event);

          if (
            !control ||
            untrack(disabled) ||
            event.defaultPrevented ||
            !isElement(target) ||
            // Only handle left clicks
            event.button !== 0
          ) {
            return;
          }

          if (isTargetDisabledThumb(target)) {
            resetPressedThumb();
            return;
          }

          const fingerCoords = { x: event.clientX, y: event.clientY };
          startPressing(fingerCoords);

          const finger = getFingerState(fingerCoords);

          if (finger == null) {
            return;
          }

          const pressedOnFocusedThumb = contains(
            thumbRefs.current[finger.thumbIndex],
            activeElement(ownerDocument(control)),
          );

          if (pressedOnFocusedThumb) {
            event.preventDefault();
          } else {
            focusFrame.request(() => {
              focusThumb(finger.thumbIndex);
            });
          }

          setDragging(true);

          const pressedOnAnyThumb = pressedThumbCenterOffsetRef.current != null;
          if (!pressedOnAnyThumb) {
            setValueFromPointer(finger, REASONS.trackPress, event);
          }

          if (event.pointerId) {
            control.setPointerCapture(event.pointerId);
          }

          moveCountRef.current = 0;
          const doc = ownerDocument(control);
          doc.addEventListener('pointermove', handleTouchMove, { passive: true });
          doc.addEventListener('pointerup', handleTouchEnd, { once: true });
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps extends BaseUIComponentProps<'div', SliderControlState> {}

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}
