import { describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { createRef } from '../solid-utils/refs';
import { getDisplacement, useSwipeDismiss, type UseSwipeDismissOptions } from './useSwipeDismiss';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

interface SwipeBoxProps {
  options?: Partial<UseSwipeDismissOptions> | undefined;
  height?: number | undefined;
  width?: number | undefined;
  children?: JSX.Element;
}

function SwipeBox(props: SwipeBoxProps): JSX.Element {
  const ref = createRef<HTMLDivElement>();
  const swipe = useSwipeDismiss({
    enabled: true,
    directions: ['down'],
    elementRef: ref,
    movementCssVars: { x: '--x', y: '--y' },
    ...props.options,
  });
  const pointerProps = swipe.getPointerProps();

  return (
    <div
      data-testid="el"
      ref={(el) => {
        ref.current = el;
        if (el && props.height !== undefined) {
          Object.defineProperty(el, 'offsetHeight', { value: props.height, configurable: true });
        }
        if (el && props.width !== undefined) {
          Object.defineProperty(el, 'offsetWidth', { value: props.width, configurable: true });
        }
      }}
      style={swipe.getDragStyles()}
      data-swiping={swipe.swiping() ? '' : undefined}
      {...pointerProps}
    >
      {props.children}
    </div>
  );
}

function pressAt(el: Element, x: number, y: number) {
  fireEvent.pointerDown(el, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

function moveTo(el: Element, x: number, y: number) {
  fireEvent.pointerMove(el, {
    buttons: 1,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

function releaseAt(el: Element, x: number, y: number) {
  fireEvent.pointerUp(el, {
    button: 0,
    buttons: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

describe.skipIf(!isJSDOM)('useSwipeDismiss', () => {
  describe('getDisplacement', () => {
    it('maps deltas onto the given direction', () => {
      expect(getDisplacement('down', 0, 50)).toBe(50);
      expect(getDisplacement('up', 0, 50)).toBe(-50);
      expect(getDisplacement('left', 50, 0)).toBe(-50);
      expect(getDisplacement('right', 50, 0)).toBe(50);
    });
  });

  it('dismisses when a swipe passes the threshold', async () => {
    const onDismiss = vi.fn();
    const onSwipeStart = vi.fn();
    render(() => <SwipeBox options={{ onDismiss, onSwipeStart }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    expect(onSwipeStart).toHaveBeenCalledTimes(1);

    moveTo(el, 0, 1);
    moveTo(el, 0, 100);
    releaseAt(el, 0, 100);
    await settle();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss.mock.calls[0][1]).toEqual({ direction: 'down' });
  });

  it('does not dismiss when the swipe stays below the threshold', async () => {
    const onDismiss = vi.fn();
    render(() => <SwipeBox options={{ onDismiss }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 20);
    releaseAt(el, 0, 20);
    await settle();

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss for movement against the allowed direction', async () => {
    const onDismiss = vi.fn();
    render(() => <SwipeBox options={{ onDismiss }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 200);
    moveTo(el, 0, 199);
    moveTo(el, 0, 50);
    releaseAt(el, 0, 50);
    await settle();

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('reports swiping state changes', async () => {
    const onSwipingChange = vi.fn();
    render(() => <SwipeBox options={{ onSwipingChange }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    expect(onSwipingChange).toHaveBeenLastCalledWith(true);

    moveTo(el, 0, 1);
    moveTo(el, 0, 100);
    releaseAt(el, 0, 100);
    await settle();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });

  it('reports swipe progress relative to the element size', async () => {
    const onProgress = vi.fn();
    render(() => <SwipeBox options={{ onProgress }} height={200} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 101);
    await settle();

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
    expect(lastCall[0]).toBeCloseTo(0.5);
    expect(lastCall[1]).toEqual(
      expect.objectContaining({ deltaY: 100, direction: 'down' }),
    );
  });

  it('applies the movement CSS variables to the element during the swipe', async () => {
    render(() => <SwipeBox />);
    await settle();

    const el = screen.getByTestId('el') as HTMLElement;
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 60);

    expect(el.style.getPropertyValue('--y')).toBe('59px');
    expect(el.style.transition).toBe('none');
  });

  it('ignores non-primary button presses', async () => {
    const onSwipeStart = vi.fn();
    render(() => <SwipeBox options={{ onSwipeStart }} />);
    await settle();

    const el = screen.getByTestId('el');
    fireEvent.pointerDown(el, {
      button: 2,
      buttons: 2,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: 'mouse',
      bubbles: true,
    });

    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const onSwipeStart = vi.fn();
    const onDismiss = vi.fn();
    render(() => <SwipeBox options={{ enabled: false, onSwipeStart, onDismiss }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 100);
    releaseAt(el, 0, 100);
    await settle();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not start swiping on interactive elements for pointer input', async () => {
    const onSwipeStart = vi.fn();
    render(() => (
      <SwipeBox options={{ onSwipeStart }}>
        <button type="button" data-testid="inner-button">
          Button
        </button>
      </SwipeBox>
    ));
    await settle();

    const button = screen.getByTestId('inner-button');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;
    try {
      pressAt(button, 0, 0);
      expect(onSwipeStart).not.toHaveBeenCalled();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start swiping within a scrollable element when ignoreScrollableAncestors is true', async () => {
    const onSwipeStart = vi.fn();

    render(() => (
      <SwipeBox options={{ ignoreScrollableAncestors: true, onSwipeStart }}>
        <div data-testid="scroll" style={{ 'overflow-y': 'auto', height: '100px' }}>
          <div style={{ height: '200px' }} />
        </div>
      </SwipeBox>
    ));
    await settle();

    const scroll = screen.getByTestId('scroll') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;
    try {
      pressAt(scroll, 0, 100);
      expect(onSwipeStart).not.toHaveBeenCalled();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('lets onRelease override the dismissal decision', async () => {
    const onDismiss = vi.fn();
    const onRelease = vi.fn((_details: unknown) => false as const);
    render(() => <SwipeBox options={{ onDismiss, onRelease }} />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 200);
    releaseAt(el, 0, 200);
    await settle();

    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onRelease.mock.calls[0][0]).toEqual(
      expect.objectContaining({ direction: 'down', deltaY: 199 }),
    );
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('resets state via reset()', async () => {
    const onSwipingChange = vi.fn();
    let resetSwipe: (() => void) | undefined;

    function ResettableSwipeBox(): JSX.Element {
      const ref = createRef<HTMLDivElement>();
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });
      resetSwipe = swipe.reset;
      const pointerProps = swipe.getPointerProps();
      return (
        <div
          data-testid="el"
          ref={(el) => {
            ref.current = el;
          }}
          {...pointerProps}
        />
      );
    }

    render(() => <ResettableSwipeBox />);
    await settle();

    const el = screen.getByTestId('el');
    pressAt(el, 0, 0);
    moveTo(el, 0, 1);
    moveTo(el, 0, 30);
    expect(onSwipingChange).toHaveBeenLastCalledWith(true);

    resetSwipe!();
    await settle();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect((el as HTMLElement).style.getPropertyValue('--y')).toBe('0px');
  });
});
