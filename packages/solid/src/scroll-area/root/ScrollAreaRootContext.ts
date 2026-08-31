import type { Accessor, Setter } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { RefObject } from '../../solid-utils/refs';
import type {
  Coords,
  HiddenState,
  OverflowEdges,
  Size,
  ScrollAreaRootState,
} from './ScrollAreaRoot';

export interface ScrollAreaRootContext {
  cornerSize: Accessor<Size>;
  setCornerSize: Setter<Size>;
  thumbSize: Accessor<Size>;
  setThumbSize: Setter<Size>;
  hasMeasuredScrollbar: Accessor<boolean>;
  setHasMeasuredScrollbar: Setter<boolean>;
  touchModality: Accessor<boolean>;
  hovering: Accessor<boolean>;
  setHovering: Setter<boolean>;
  scrollingX: Accessor<boolean>;
  scrollingY: Accessor<boolean>;
  viewportRef: RefObject<HTMLDivElement>;
  scrollbarYRef: RefObject<HTMLDivElement>;
  thumbYRef: RefObject<HTMLDivElement>;
  scrollbarXRef: RefObject<HTMLDivElement>;
  thumbXRef: RefObject<HTMLDivElement>;
  cornerRef: RefObject<HTMLDivElement>;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleScroll: (scrollPosition: Coords) => void;
  disableViewportSnap: () => void;
  rootId: Accessor<string | undefined>;
  hiddenState: Accessor<HiddenState>;
  setHiddenState: Setter<HiddenState>;
  overflowEdges: Accessor<OverflowEdges>;
  setOverflowEdges: Setter<OverflowEdges>;
  viewportState: ScrollAreaRootState;
  overflowEdgeThreshold: Accessor<{
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  }>;
}

export const ScrollAreaRootContext = createOptionalContext<ScrollAreaRootContext>();

export function useScrollAreaRootContext() {
  const context = useOptionalContext(ScrollAreaRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  }
  return context;
}
