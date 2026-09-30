import { createMemo, createRenderEffect, createSignal, type Accessor } from 'solid-js';
import { ownerDocument } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useDrawerRootContext } from './DrawerRootContext';
import type { DrawerSnapPoint } from './DrawerRootContext';

export interface ResolvedDrawerSnapPoint {
  value: DrawerSnapPoint;
  height: number;
  offset: number;
}

/**
 * Resolves the vertical swipe movement for a snap point, applying square-root damping once the drag
 * overshoots the fully-open edge (`nextOffset < 0`) so the popup resists travelling past it.
 */
export function getSnapPointSwipeMovement(baseOffset: number, movementValue: number): number {
  const nextOffset = baseOffset + movementValue;
  if (nextOffset >= 0) {
    return movementValue;
  }

  return -Math.sqrt(-nextOffset) - baseOffset;
}

function resolveSnapPointValue(
  snapPoint: DrawerSnapPoint,
  viewportHeight: number,
  rootFontSize: number,
) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }

  if (typeof snapPoint === 'number') {
    if (!Number.isFinite(snapPoint)) {
      return null;
    }

    if (snapPoint <= 1) {
      return clamp(snapPoint, 0, 1) * viewportHeight;
    }

    return snapPoint;
  }

  const trimmed = snapPoint.trim();

  if (trimmed.endsWith('px')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  if (trimmed.endsWith('rem')) {
    const value = Number.parseFloat(trimmed);
    return Number.isFinite(value) ? value * rootFontSize : null;
  }

  return null;
}

/**
 * Returns the index of the value closest to `target`, or `-1` if `values` is empty.
 */
export function closestSnapPointIndex(values: number[], target: number): number {
  let closestIndex = -1;
  let closestDistance = Infinity;

  for (let index = 0; index < values.length; index += 1) {
    const distance = Math.abs(values[index] - target);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function useDrawerSnapPoints() {
  const store = useDialogRootContext();
  const { snapPoints, activeSnapPoint, setActiveSnapPoint, popupHeight } = useDrawerRootContext();
  const viewportElement = store.useState('viewportElement');

  const [viewportHeight, setViewportHeight] = createSignal(0, { ownedWrite: true });
  const [rootFontSize, setRootFontSize] = createSignal(16, { ownedWrite: true });

  const measureViewportHeight = () => {
    const element = viewportElement();
    const doc = ownerDocument(element);
    const html = doc.documentElement;

    setViewportHeight(element ? element.offsetHeight : html.clientHeight);

    const fontSize = parseFloat(getComputedStyle(html).fontSize);
    if (Number.isFinite(fontSize)) {
      setRootFontSize(fontSize);
    }
  };

  createRenderEffect(
    () => viewportElement(),
    (element) => {
      measureViewportHeight();

      if (!element || typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureViewportHeight);
      resizeObserver.observe(element);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  const resolvedSnapPoints = createMemo<ResolvedDrawerSnapPoint[]>(() => {
    const points = snapPoints();
    const currentViewportHeight = viewportHeight();
    const currentPopupHeight = popupHeight();
    if (!points || points.length === 0 || currentViewportHeight <= 0 || currentPopupHeight <= 0) {
      return [];
    }

    const maxHeight = Math.min(currentPopupHeight, currentViewportHeight);

    const resolved = points
      .map((value): ResolvedDrawerSnapPoint | null => {
        const resolvedHeight = resolveSnapPointValue(value, currentViewportHeight, rootFontSize());
        if (resolvedHeight === null) {
          return null;
        }

        const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
        return {
          value,
          height: clampedHeight,
          offset: Math.max(0, currentPopupHeight - clampedHeight),
        };
      })
      .filter((point): point is ResolvedDrawerSnapPoint => Boolean(point));

    if (resolved.length <= 1) {
      return resolved;
    }

    const deduped: ResolvedDrawerSnapPoint[] = [];
    const seenHeights: number[] = [];

    for (let index = resolved.length - 1; index >= 0; index -= 1) {
      const point = resolved[index];
      const isDuplicate = seenHeights.some((height) => Math.abs(height - point.height) <= 1);
      if (isDuplicate) {
        continue;
      }

      seenHeights.push(point.height);
      deduped.push(point);
    }

    deduped.reverse();
    return deduped;
  });

  const resolvedActiveSnapPoint = createMemo(() => {
    const active = activeSnapPoint();
    if (active === null) {
      return undefined;
    }

    const points = resolvedSnapPoints();
    const exactMatch = points.find((point) => Object.is(point.value, active));
    if (exactMatch) {
      return exactMatch;
    }

    const maxHeight = Math.min(popupHeight(), viewportHeight());
    const resolvedHeight = resolveSnapPointValue(active, viewportHeight(), rootFontSize());
    if (resolvedHeight === null) {
      return undefined;
    }

    const clampedHeight = clamp(resolvedHeight, 0, maxHeight);
    return points[
      closestSnapPointIndex(
        points.map((point) => point.height),
        clampedHeight,
      )
    ];
  });

  const activeSnapPointOffset: Accessor<number | null> = () =>
    resolvedActiveSnapPoint()?.offset ?? null;

  return {
    snapPoints,
    activeSnapPoint,
    setActiveSnapPoint,
    popupHeight,
    viewportHeight,
    resolvedSnapPoints,
    activeSnapPointOffset,
  };
}
