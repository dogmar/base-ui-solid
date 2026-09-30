import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { getWindow } from '@floating-ui/utils/dom';
import type { ContextData, ElementProps, FloatingContext, FloatingRootContext } from '../types';
import type { HTMLProps } from '../../internals/types';
import { contains, getTarget } from '../utils/element';
import { isMouseLikePointerType } from '../utils/event';

function createVirtualElement(
  domElement: Element | null | undefined,
  data: {
    axis: 'x' | 'y' | 'both';
    dataRef: { current: ContextData };
    pointerType: string | undefined;
    x: number | null;
    y: number | null;
  },
) {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: domElement || undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() || {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      };

      const isXAxis = data.axis === 'x' || data.axis === 'both';
      const isYAxis = data.axis === 'y' || data.axis === 'both';
      const canTrackCursorOnAutoUpdate =
        ['mouseenter', 'mousemove'].includes(data.dataRef.current.openEvent?.type || '') &&
        data.pointerType !== 'touch';

      let width = domRect.width;
      let height = domRect.height;
      let x = domRect.x;
      let y = domRect.y;

      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }

      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;
      width = 0;
      height = 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        width = data.axis === 'y' ? domRect.width : 0;
        height = data.axis === 'x' ? domRect.height : 0;
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      } else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
        height = data.axis === 'x' ? domRect.height : height;
        width = data.axis === 'y' ? domRect.width : width;
      }

      isAutoUpdateEvent = true;

      return {
        width,
        height,
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
      };
    },
  };
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

export interface UseClientPointProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to restrict the client point to an axis and use the reference
   * element (if it exists) as the other axis. This can be useful if the
   * floating element is also interactive.
   * @default 'both'
   */
  axis?: 'x' | 'y' | 'both' | undefined;
}

/**
 * Positions the floating element relative to a client point (in the viewport),
 * such as the mouse position. By default, it follows the mouse cursor.
 *
 * Solid port notes: `props` should be a reactive object (use getters for
 * reactive values); the option values are read lazily.
 * @see https://floating-ui.com/docs/useClientPoint
 */
export function useClientPoint(
  context: FloatingRootContext | FloatingContext,
  props: UseClientPointProps = {},
): ElementProps {
  const enabled = () => props.enabled ?? true;
  const axis = () => props.axis ?? 'both';

  const store = 'rootStore' in context ? context.rootStore : context;

  const open = store.useState('open');
  const floating = store.useState('floatingElement');
  const domReference = store.useState('domReferenceElement');

  const dataRef = store.context.dataRef;

  let initial = false;
  let cleanupListenerRef: null | (() => void) = null;

  const [pointerType, setPointerType] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [reactive, setReactive] = createSignal<never[]>([], { ownedWrite: true });

  const resetReference = (reference: Element | null) => {
    store.set('positionReference', reference);
  };

  const setReference = (newX: number | null, newY: number | null, referenceElement?: Element | null) => {
    if (initial) {
      return;
    }

    // Prevent setting if the open event was not a mouse-like one
    // (e.g. focus to open, then hover over the reference element).
    // Only apply if the event exists.
    if (dataRef.current.openEvent && !isMouseBasedEvent(dataRef.current.openEvent)) {
      return;
    }

    store.set(
      'positionReference',
      createVirtualElement(referenceElement ?? domReference(), {
        x: newX,
        y: newY,
        axis: axis(),
        dataRef,
        pointerType: pointerType(),
      }),
    );
  };

  const handleReferenceEnterOrMove = (event: MouseEvent) => {
    if (!open()) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    } else if (!cleanupListenerRef) {
      // If there's no cleanup, there's no listener, but we want to ensure
      // we add the listener if the cursor landed on the floating element and
      // then back on the reference (i.e. it's interactive).
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
      setReactive([]);
    }
  };

  // If the pointer is a mouse-like pointer, we want to continue following the
  // mouse even if the floating element is transitioning out. On touch
  // devices, this is undesirable because the floating element will move to
  // the dismissal touch point.
  const openCheck = () => (isMouseLikePointerType(pointerType()) ? floating() : open());

  // Mirrors the React effect's dependency array: the apply phase only re-runs
  // when one of these values actually changes (`Object.is` per entry), so the
  // window listener is not detached/re-attached when unrelated store state
  // (such as `positionReference`) changes.
  const listenerDeps = createMemo(
    () => ({
      openCheck: openCheck(),
      enabled: enabled(),
      floating: floating(),
      domReference: domReference(),
      reactive: reactive(),
    }),
    {
      equals: (a, b) =>
        a.openCheck === b.openCheck &&
        a.enabled === b.enabled &&
        a.floating === b.floating &&
        a.domReference === b.domReference &&
        a.reactive === b.reactive,
    },
  );

  createEffect(
    () => listenerDeps(),
    (current) => {
      if (!current.enabled) {
        resetReference(current.domReference);
        return undefined;
      }

      if (!current.openCheck) {
        return undefined;
      }

      function cleanupListener() {
        cleanupListenerRef?.();
        cleanupListenerRef = null;
      }

      const win = getWindow(current.floating);

      function handleMouseMove(event: MouseEvent) {
        const target = getTarget(event) as Element | null;

        if (!contains(current.floating, target)) {
          setReference(event.clientX, event.clientY);
        } else {
          cleanupListener();
        }
      }

      if (!dataRef.current.openEvent || isMouseBasedEvent(dataRef.current.openEvent)) {
        cleanupListenerRef = addEventListener(win, 'mousemove', handleMouseMove);
      } else {
        resetReference(current.domReference);
      }

      return cleanupListener;
    },
  );

  // Clear virtual cursor references when the hook unmounts. Enabled flips are handled above.
  onCleanup(() => {
    store.set('positionReference', null);
  });

  const initialResetDeps = createMemo(() => ({ enabled: enabled(), floating: floating() }), {
    equals: (a, b) => a.enabled === b.enabled && a.floating === b.floating,
  });
  createEffect(
    () => initialResetDeps(),
    (current) => {
      if (current.enabled && !current.floating) {
        initial = false;
      }
    },
  );

  const initialSetDeps = createMemo(() => ({ enabled: enabled(), open: open() }), {
    equals: (a, b) => a.enabled === b.enabled && a.open === b.open,
  });
  createEffect(
    () => initialSetDeps(),
    (current) => {
      if (!current.enabled && current.open) {
        initial = true;
      }
    },
  );

  function setPointerTypeRef(event: PointerEvent) {
    setPointerType(event.pointerType);
  }

  const referenceProps: HTMLProps = {
    onPointerDown: setPointerTypeRef,
    onPointerEnter: setPointerTypeRef,
    onMouseMove: handleReferenceEnterOrMove,
    onMouseEnter: handleReferenceEnterOrMove,
  };

  return {
    get reference() {
      return enabled() ? referenceProps : undefined;
    },
    get trigger() {
      return enabled() ? referenceProps : undefined;
    },
  };
}
