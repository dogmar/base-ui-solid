import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '@base-ui/utils/owner';
import { getTarget } from '@base-ui/utils/shadowDom';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import type { HTMLProps } from '../types';
import { useLabelableContext } from './LabelableContext';

export function useLabel(params: UseLabelParameters = {}): UseLabelReturnValue {
  const native = () => params.native ?? false;

  const context = useLabelableContext();
  const setContextLabelId = context.setLabelId;

  const syncLabelId = (
    nextLabelId: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => {
    setContextLabelId(nextLabelId);
    params.setLabelId?.(nextLabelId);
  };

  const id = useRegisteredLabelId(() => params.id, syncLabelId);

  const resolvedControlId = () => context.controlId() ?? params.fallbackControlId;

  function focusControl(event: MouseEvent) {
    if (params.focusControl) {
      params.focusControl(event, resolvedControlId() ?? undefined);
      return;
    }

    const controlId = resolvedControlId();
    if (!controlId) {
      return;
    }

    const controlElement = ownerDocument(event.currentTarget as Element | null).getElementById(
      controlId,
    );
    if (isHTMLElement(controlElement)) {
      focusElementWithVisible(controlElement);
    }
  }

  function handleInteraction(event: MouseEvent) {
    const target = getTarget(event) as HTMLElement | null;
    if (target?.closest('button,input,select,textarea')) {
      return;
    }

    // Prevent text selection when double clicking label.
    if (!event.defaultPrevented && event.detail > 1) {
      event.preventDefault();
    }

    if (native()) {
      return;
    }

    focusControl(event);
  }

  // The React version returns different prop sets for native and non-native labels.
  // Components run once in Solid, so a single reactive object branches internally.
  return {
    get id() {
      return id();
    },
    get for() {
      if (!native()) {
        return undefined;
      }
      return resolvedControlId() ?? undefined;
    },
    onMouseDown(event: MouseEvent) {
      if (native()) {
        handleInteraction(event);
      }
    },
    onClick(event: MouseEvent) {
      if (!native()) {
        handleInteraction(event);
      }
    },
    onPointerDown(event: PointerEvent) {
      if (!native()) {
        event.preventDefault();
      }
    },
  };
}

export interface UseLabelParameters {
  id?: string | undefined;
  /**
   * Control id used when no labelable context control id exists.
   */
  fallbackControlId?: string | undefined;
  /**
   * Whether the rendered element is a native `<label>`.
   * @default false
   */
  native?: boolean | undefined;
  /**
   * Additional callback to sync the current label id with local component state/store.
   */
  setLabelId?:
    | ((value: string | undefined | ((prev: string | undefined) => string | undefined)) => void)
    | undefined;
  /**
   * Custom focus handler for non-native labels.
   * If omitted, focus behavior targets the resolved control id.
   */
  focusControl?: ((event: MouseEvent, controlId: string | undefined) => void) | undefined;
}

export type UseLabelReturnValue = HTMLProps;

export function focusElementWithVisible(element: HTMLElement) {
  element.focus({
    // Available from Chrome 144+ (January 2026).
    // Safari and Firefox already support it.
    focusVisible: true,
  } as FocusOptions);
}
