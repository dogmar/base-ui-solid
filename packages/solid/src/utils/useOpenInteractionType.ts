import { createSignal, untrack, type Accessor } from 'solid-js';
import { type InteractionType } from '@base-ui/utils/useEnhancedClickHandler';
import { platform } from '@base-ui/utils/platform';
import { useValueChanged } from '../internals/useValueChanged';
import type { HTMLProps } from '../internals/types';

/**
 * Returns trigger props that record the interaction type used to open a popup.
 * Solid port of `useOpenMethodTriggerProps`: `open` is an accessor and the
 * returned handlers are plain, stable functions.
 *
 * The enhanced click detection from `@base-ui/utils/useEnhancedClickHandler`
 * (a React hook) is inlined here as plain closures.
 */
export function useOpenMethodTriggerProps(
  open: Accessor<boolean>,
  setOpenMethod: (interactionType: InteractionType | null) => void,
): HTMLProps {
  let lastClickInteractionType: InteractionType = '';

  const handleTriggerClick = (
    _event: MouseEvent | PointerEvent,
    interactionType: InteractionType,
  ) => {
    if (!untrack(open)) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
          // will be "" in that case.
          (platform.os.ios ? 'touch' : ''),
      );
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    lastClickInteractionType = event.pointerType as InteractionType;
    handleTriggerClick(event, event.pointerType as InteractionType);
  };

  const onClick = (event: MouseEvent | PointerEvent) => {
    // event.detail has the number of clicks performed on the element. 0 means it was triggered by the keyboard.
    if (event.detail === 0) {
      handleTriggerClick(event, 'keyboard');
      return;
    }

    if ('pointerType' in event) {
      // Chrome and Edge correctly use PointerEvent
      handleTriggerClick(event, event.pointerType as InteractionType);
    } else {
      handleTriggerClick(event, lastClickInteractionType);
    }
    lastClickInteractionType = '';
  };

  return { onClick, onPointerDown };
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 * Solid port: `open` is an accessor and `openMethod` is returned as an accessor.
 *
 * @param open Accessor for the open state of the component.
 */
export function useOpenInteractionType(open: Accessor<boolean>) {
  const [openMethod, setOpenMethod] = createSignal<InteractionType | null>(null, {
    ownedWrite: true,
  });

  const triggerProps = useOpenMethodTriggerProps(open, setOpenMethod);

  useValueChanged(open, (previousOpen) => {
    if (previousOpen && !untrack(open)) {
      setOpenMethod(null);
    }
  });

  return {
    openMethod,
    triggerProps,
  };
}
