import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  flush,
  onCleanup,
  untrack,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { computePosition, type ComputePositionConfig } from '@floating-ui/dom';
import { isElement } from '@floating-ui/utils/dom';
import { createRef } from '../../solid-utils/refs';
import { FloatingRootStore } from '../components/FloatingRootStore';
import { useFloatingTree } from '../components/FloatingTree';
import type {
  FloatingContext,
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
  UsePositionFloatingReturn,
  VirtualElement,
} from '../types';
import { useFloatingRootContext } from './useFloatingRootContext';

/**
 * Provides data to position a floating element and context to add interactions.
 *
 * Solid port notes: `options` should be a reactive object (use getters for
 * reactive values); reactive return values are accessors.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
  const internalStore = useFloatingRootContext(options);
  const store = untrack(() => options.rootContext) || internalStore;

  return useFloatingWithStore(options, store);
}

/**
 * Base UI's private `useFloating` path. The caller must supply the root store, so this skips the
 * internal root-context hook used by the public Floating UI-compatible API.
 */
export function useBaseUIFloating(
  options: UseFloatingOptions & { rootContext: FloatingRootStore },
): UseFloatingReturn {
  return useFloatingWithStore(options, untrack(() => options.rootContext));
}

function useFloatingWithStore(
  options: UseFloatingOptions,
  store: FloatingRootStore,
): UseFloatingReturn {
  const referenceElement = store.useState('referenceElement');
  const floatingElement = store.useState('floatingElement');
  const domReferenceElement = store.useState('domReferenceElement');
  const open = store.useState('open');
  const floatingId = store.useState('floatingId');

  const [positionReference, setPositionReferenceRaw] = createSignal<ReferenceType | null>(null, {
    ownedWrite: true,
  });
  const [localDomReference, setLocalDomReference] = createSignal<
    NarrowedElement<ReferenceType> | null | undefined
  >(undefined, { ownedWrite: true });
  const [localFloatingElement, setLocalFloatingElement] = createSignal<
    HTMLElement | null | undefined
  >(undefined, { ownedWrite: true });

  const domReferenceRef = createRef<NarrowedElement<ReferenceType>>();

  const tree = useFloatingTree(untrack(() => options.externalTree));

  const position = usePosition(options, {
    reference: () => positionReference() ?? referenceElement(),
    floating: floatingElement,
  });

  store.useSyncedValue('referenceElement', () => localDomReference() ?? null);
  store.useSyncedValue('domReferenceElement', () => {
    const local = localDomReference();
    if (local === undefined) {
      return domReferenceElement();
    }
    return isElement(local) ? (local as Element) : null;
  });
  store.useSyncedValue('floatingElement', () => {
    const local = localFloatingElement();
    return local === undefined ? store.state.floatingElement : local;
  });

  const setPositionReference = (node: ReferenceType | null) => {
    const computedPositionReference = isElement(node)
      ? ({
          getBoundingClientRect: () => node.getBoundingClientRect(),
          getClientRects: () => node.getClientRects(),
          contextElement: node,
        } satisfies VirtualElement)
      : node;
    // Store the positionReference in state if the DOM reference is specified externally via the
    // `elements.reference` option. This ensures that it won't be overridden on future renders.
    setPositionReferenceRaw(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  };

  const setReference = (node: ReferenceType | null) => {
    if (isElement(node) || node === null) {
      domReferenceRef.current = node as NarrowedElement<ReferenceType> | null;
      setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
    }

    // Backwards-compatibility for passing a virtual element to `reference`
    // after it has set the DOM reference.
    if (
      isElement(position.refs.reference.current) ||
      position.refs.reference.current === null ||
      // Don't allow setting virtual elements using the old technique back to
      // `null` to support `positionReference` + an unstable `reference`
      // callback ref.
      (node !== null && !isElement(node))
    ) {
      position.refs.setReference(node);
    }
  };

  const setFloating = (node: HTMLElement | null) => {
    setLocalFloatingElement(node);
    position.refs.setFloating(node);
  };

  const refs: UseFloatingReturn['refs'] = {
    reference: position.refs.reference,
    floating: position.refs.floating,
    setReference,
    setFloating,
    setPositionReference,
    domReference: domReferenceRef,
  };

  const elements: UseFloatingReturn['elements'] = {
    reference: position.elements.reference,
    floating: position.elements.floating,
    domReference: domReferenceElement as Accessor<NarrowedElement<ReferenceType> | null>,
  };

  const context: FloatingContext = {
    x: position.x,
    y: position.y,
    placement: position.placement,
    strategy: position.strategy,
    middlewareData: position.middlewareData,
    isPositioned: position.isPositioned,
    update: position.update,
    floatingStyles: position.floatingStyles,
    dataRef: store.context.dataRef,
    open,
    onOpenChange: store.setOpen,
    events: store.context.events,
    floatingId,
    refs,
    elements,
    nodeId: () => options.nodeId,
    rootStore: store,
  };

  createRenderEffect(
    () => domReferenceElement(),
    (element) => {
      if (element) {
        domReferenceRef.current = element as NarrowedElement<ReferenceType> | null;
      }
    },
  );

  createRenderEffect(
    () => options.nodeId,
    (nodeId) => {
      store.context.dataRef.current.floatingContext = context;

      const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.context = context;
      }
    },
  );

  return {
    x: position.x,
    y: position.y,
    placement: position.placement,
    strategy: position.strategy,
    middlewareData: position.middlewareData,
    isPositioned: position.isPositioned,
    update: position.update,
    floatingStyles: position.floatingStyles,
    context,
    refs,
    elements,
    rootStore: store,
  } as UseFloatingReturn;
}

interface PositionState {
  x: number;
  y: number;
  placement: NonNullable<UseFloatingOptions['placement']>;
  strategy: NonNullable<UseFloatingOptions['strategy']>;
  middlewareData: Record<string, any>;
  isPositioned: boolean;
}

/**
 * Reactive positioning engine built directly on `@floating-ui/dom`'s
 * `computePosition`. Solid re-implementation of `useFloating` from
 * `@floating-ui/react-dom`.
 *
 * `options` should be a reactive object; `elements` are accessors for the
 * externally-owned reference and floating elements (they take precedence over
 * elements passed to `refs.setReference`/`refs.setFloating`).
 */
function usePosition(
  options: UseFloatingOptions,
  externalElements: {
    reference: Accessor<ReferenceType | null>;
    floating: Accessor<HTMLElement | null>;
  },
): UsePositionFloatingReturn {
  const placementOption = () => options.placement ?? 'bottom';
  const strategyOption = () => options.strategy ?? 'absolute';
  const transformOption = () => options.transform ?? true;

  const [data, setData] = createSignal<PositionState>(
    {
      x: 0,
      y: 0,
      strategy: untrack(strategyOption),
      placement: untrack(placementOption),
      middlewareData: {},
      isPositioned: false,
    },
    { ownedWrite: true },
  );

  const latestMiddleware = createMemo(() => options.middleware ?? [], { equals: deepEqual });

  const [internalReference, setInternalReference] = createSignal<ReferenceType | null>(null, {
    ownedWrite: true,
  });
  const [internalFloating, setInternalFloating] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });

  const referenceEl = () => externalElements.reference() || internalReference();
  const floatingEl = () => externalElements.floating() || internalFloating();

  const referenceRef = createRef<ReferenceType>();
  const floatingRef = createRef<HTMLElement>();

  let isMounted = true;
  onCleanup(() => {
    isMounted = false;
  });

  const setReference = (node: ReferenceType | null) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      setInternalReference(node);
    }
  };

  const setFloating = (node: HTMLElement | null) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      setInternalFloating(node);
    }
  };

  const update = () => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }

    const config: ComputePositionConfig = {
      placement: untrack(placementOption),
      strategy: untrack(strategyOption),
      middleware: untrack(latestMiddleware),
    };

    const platformOption = untrack(() => options.platform);
    if (platformOption) {
      config.platform = platformOption;
    }

    computePosition(referenceRef.current, floatingRef.current, config).then((positionData) => {
      const fullData: PositionState = {
        ...positionData,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: untrack(() => options.open) !== false,
      };
      if (isMounted && !deepEqual(untrack(data), fullData)) {
        setData(fullData);
        flush();
      }
    });
  };

  createEffect(
    () => options.open,
    (openOption) => {
      if (openOption === false && untrack(data).isPositioned) {
        setData((d) => ({ ...d, isPositioned: false }));
      }
    },
  );

  // Mirrors the React effect's dependency array: the apply phase only re-runs
  // when one of these values actually changes (`Object.is` per entry), so
  // `whileElementsMounted` is not detached/re-attached spuriously.
  const mountDeps = createMemo(
    () => ({
      reference: referenceEl(),
      floating: floatingEl(),
      // Dependencies of `update` — mirror the React `useCallback` deps so the
      // elements are re-measured (and `autoUpdate` re-attached) when they
      // change.
      placement: placementOption(),
      strategy: strategyOption(),
      middleware: latestMiddleware(),
      whileElementsMounted: options.whileElementsMounted,
    }),
    {
      equals: (a, b) =>
        a.reference === b.reference &&
        a.floating === b.floating &&
        a.placement === b.placement &&
        a.strategy === b.strategy &&
        a.middleware === b.middleware &&
        a.whileElementsMounted === b.whileElementsMounted,
    },
  );

  createEffect(
    () => mountDeps(),
    ({ reference, floating, whileElementsMounted }) => {
      if (reference) {
        referenceRef.current = reference;
      }
      if (floating) {
        floatingRef.current = floating;
      }
      if (reference && floating) {
        if (whileElementsMounted) {
          return whileElementsMounted(reference, floating, update);
        }
        update();
      }
      return undefined;
    },
  );

  const floatingStyles = createMemo<JSX.CSSProperties>(() => {
    const initialStyles: JSX.CSSProperties = {
      position: strategyOption(),
      left: '0',
      top: '0',
    };
    const floating = floatingEl();
    if (!floating) {
      return initialStyles;
    }
    const positionData = data();
    const x = roundByDPR(floating, positionData.x);
    const y = roundByDPR(floating, positionData.y);

    if (transformOption()) {
      return {
        ...initialStyles,
        transform: `translate(${x}px, ${y}px)`,
        ...(getDPR(floating) >= 1.5 && { 'will-change': 'transform' }),
      };
    }

    return {
      position: strategyOption(),
      left: `${x}px`,
      top: `${y}px`,
    };
  });

  return {
    x: () => data().x,
    y: () => data().y,
    placement: () => data().placement,
    strategy: () => data().strategy,
    middlewareData: () => data().middlewareData,
    isPositioned: () => data().isPositioned,
    update,
    floatingStyles,
    refs: {
      reference: referenceRef,
      floating: floatingRef,
      setReference,
      setFloating,
    },
    elements: {
      reference: referenceEl,
      floating: floatingEl,
    },
  };
}

function getDPR(element: Element): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}

function roundByDPR(element: Element, value: number) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}

// Fork of `fast-deep-equal` that only does the comparisons we need and compares
// functions
function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a === 'function' && a.toString() === b.toString()) {
    return true;
  }

  let length: number;
  let i: number;
  let keys: string[];

  if (a && b && typeof a === 'object') {
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) {
        return false;
      }
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) {
      return false;
    }

    for (i = length; i-- !== 0; ) {
      if (!{}.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }

    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  // eslint-disable-next-line no-self-compare
  return a !== a && b !== b;
}
