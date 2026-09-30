import { flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import type { TextDirection } from '../../direction-provider';
import { DirectionProvider } from '../../direction-provider';
import { ScrollArea } from '..';
import { SCROLL_TIMEOUT } from '../constants';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<ScrollArea.Scrollbar />', () => {
  it('is hidden from the accessibility tree by default', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>
    ));
    flush();

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted data-testid="scrollbar" aria-hidden={undefined} />
      </ScrollArea.Root>
    ));
    flush();

    expect(screen.getByTestId('scrollbar')).not.toHaveAttribute('aria-hidden');
  });

  it('sets the orientation data attribute', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted data-testid="scrollbar" />
      </ScrollArea.Root>
    ));
    flush();

    expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('supports a custom scrollbar renderer', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport />
        <ScrollArea.Scrollbar
          data-testid="scrollbar"
          keepMounted
          render={(props) => <div {...props} />}
        />
      </ScrollArea.Root>
    ));
    flush();

    expect(screen.getByTestId('scrollbar')).toBeInTheDocument();
  });

  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled in the correct direction', () => {
      render(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted />
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal" keepMounted />
          <ScrollArea.Corner />
        </ScrollArea.Root>
      ));
      flush();

      const verticalScrollbar = screen.getByTestId('vertical');
      const horizontalScrollbar = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(verticalScrollbar).toHaveAttribute('data-scrolling', '');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling', '');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      vi.advanceTimersByTime(1); // vertical just finished
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 2); // already ticked 1ms above
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalScrollbar).not.toHaveAttribute('data-scrolling');
      expect(horizontalScrollbar).not.toHaveAttribute('data-scrolling');
    });
  });

  describe('data-hovering attribute', () => {
    it('detects a viewport that is already hovered on mount', async () => {
      const originalMatches = Element.prototype.matches;
      const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function matches(
        this: Element,
        selector: string,
      ) {
        if (selector === ':hover' && (this as HTMLElement).dataset.testid === 'viewport') {
          return true;
        }
        return originalMatches.call(this, selector);
      });

      try {
        render(() => (
          <ScrollArea.Root>
            <ScrollArea.Viewport data-testid="viewport" />
            <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>
        ));
        await settle();

        await waitFor(() =>
          expect(screen.getByTestId('scrollbar')).toHaveAttribute('data-hovering'),
        );
      } finally {
        matchesSpy.mockRestore();
      }
    });

    it('does not enter hover state for touch pointers', () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>
      ));
      flush();

      const root = screen.getByTestId('root');
      const scrollbar = screen.getByTestId('scrollbar');

      fireEvent.pointerEnter(root, { pointerType: 'touch' });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-hovering');
    });

    it('adds [data-hovering] when a mouse pointer enters the scroll area', () => {
      render(() => (
        <ScrollArea.Root data-testid="root">
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>
      ));
      flush();

      const root = screen.getByTestId('root');
      const scrollbar = screen.getByTestId('scrollbar');

      fireEvent.pointerEnter(root, { pointerType: 'mouse' });
      flush();

      expect(scrollbar).toHaveAttribute('data-hovering', '');

      fireEvent.pointerLeave(root, { pointerType: 'mouse' });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-hovering');
    });
  });

  describe('track pointer down', () => {
    it('ignores non-primary pointer presses', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const viewport = screen.getByTestId('viewport');
      fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 2,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('handles a track press when no viewport is mounted', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const scrollbar = screen.getByTestId('scrollbar');
      fireEvent.pointerDown(scrollbar, { button: 0, clientY: 100, pointerId: 1 });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not start a track gesture without a thumb', () => {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted />
        </ScrollArea.Root>
      ));
      flush();

      const viewport = screen.getByTestId('viewport');
      fireEvent.pointerDown(screen.getByTestId('scrollbar'), {
        button: 0,
        clientY: 100,
        pointerId: 1,
      });

      expect(viewport.scrollTop).toBe(0);
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores thumb clicks when the native path differs from the synthetic target', () => {
      render(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperties(thumb, {
        offsetHeight: {
          configurable: true,
          value: 40,
        },
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
      });

      const event = new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientY: 160,
      });

      Object.defineProperty(event, 'composedPath', {
        configurable: true,
        value: () => [thumb, verticalScrollbar],
      });

      fireEvent(verticalScrollbar, event);
      flush();

      expect(viewport.scrollTop).toBe(0);
    });

    it('marks the scroll area as scrolling when pressing the track', async () => {
      render(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperties(thumb, {
        offsetHeight: {
          configurable: true,
          value: 40,
        },
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
      });

      fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });
      flush();

      expect(viewport.scrollTop).not.toBe(0);
      await waitFor(() => expect(verticalScrollbar).toHaveAttribute('data-scrolling'));
    });

    it('clears track drag state on pointer cancel', () => {
      render(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const verticalScrollbar = screen.getByTestId('vertical');
      const thumb = screen.getByTestId('thumb');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: 0,
        },
      });

      Object.defineProperties(verticalScrollbar, {
        offsetHeight: {
          configurable: true,
          value: 200,
        },
        getBoundingClientRect: {
          configurable: true,
          value: () => ({
            top: 0,
          }),
        },
      });

      Object.defineProperties(thumb, {
        offsetHeight: {
          configurable: true,
          value: 40,
        },
        setPointerCapture: {
          configurable: true,
          value: () => {},
        },
        hasPointerCapture: {
          configurable: true,
          value: () => false,
        },
      });

      fireEvent.pointerDown(verticalScrollbar, { button: 0, clientY: 160, pointerId: 1 });
      flush();

      const scrollTopAfterTrackPress = viewport.scrollTop;

      fireEvent.pointerCancel(verticalScrollbar, { pointerId: 1 });
      fireEvent.pointerMove(thumb, { clientY: 180, pointerId: 1, buttons: 1 });
      flush();

      expect(viewport.scrollTop).toBe(scrollTopAfterTrackPress);
    });
  });

  // jsdom doesn't implement the focus side of a mouse press, so these assert the
  // cancellation that suppresses it rather than the resulting `activeElement`.
  describe('track mouse down', () => {
    function renderScrollbarWithThumb() {
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Viewport data-testid="viewport" />
          <ScrollArea.Scrollbar data-testid="scrollbar" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();
    }

    // Native scrollbars keep focus for every button, not just the primary one.
    it.each([
      { name: 'primary', button: 0 },
      { name: 'middle', button: 1 },
      { name: 'secondary', button: 2 },
    ])('cancels a $name press on the track so focus stays on the active element', ({ button }) => {
      renderScrollbarWithThumb();

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button });
      screen.getByTestId('scrollbar').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it('cancels the press on the thumb so focus stays on the active element', () => {
      renderScrollbarWithThumb();

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      screen.getByTestId('thumb').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('wheel', () => {
    async function renderWheelTest(props: {
      direction?: TextDirection;
      orientation?: 'horizontal' | 'vertical';
      scrollLeft?: number;
      scrollTop?: number;
    }) {
      const {
        direction = 'ltr',
        orientation = 'horizontal',
        scrollLeft = 0,
        scrollTop = 0,
      } = props;

      render(() => (
        <DirectionProvider direction={direction}>
          <ScrollArea.Root style={{ width: '200px', height: '200px', direction }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: '1000px', height: '1000px' }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation={orientation} data-testid="scrollbar" keepMounted />
          </ScrollArea.Root>
        </DirectionProvider>
      ));
      await settle();

      const viewport = screen.getByTestId('viewport') as HTMLDivElement;
      const scrollbar = screen.getByTestId('scrollbar');

      Object.defineProperties(viewport, {
        clientHeight: {
          configurable: true,
          value: 200,
        },
        clientWidth: {
          configurable: true,
          value: 200,
        },
        scrollHeight: {
          configurable: true,
          value: 1000,
        },
        scrollWidth: {
          configurable: true,
          value: 1000,
        },
        scrollLeft: {
          configurable: true,
          writable: true,
          value: scrollLeft,
        },
        scrollTop: {
          configurable: true,
          writable: true,
          value: scrollTop,
        },
      });

      return { viewport, scrollbar };
    }

    it('allows horizontal scrolling away from the RTL start edge', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'rtl' });

      fireEvent.wheel(scrollbar, { deltaX: -50 });

      expect(viewport.scrollLeft).toBe(-50);
    });

    it('clamps horizontal LTR wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'ltr' });

      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = 790;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);

      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(800);
    });

    it('clamps horizontal RTL wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ direction: 'rtl' });

      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);

      viewport.scrollLeft = -100;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(-50);

      viewport.scrollLeft = -790;
      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      fireEvent.wheel(scrollbar, { deltaX: -50 });
      expect(viewport.scrollLeft).toBe(-800);

      viewport.scrollLeft = -10;
      fireEvent.wheel(scrollbar, { deltaX: 50 });
      expect(viewport.scrollLeft).toBe(0);
    });

    it('clamps vertical wheel scrolling at both edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      fireEvent.wheel(scrollbar, { deltaY: -50 });
      expect(viewport.scrollTop).toBe(0);

      viewport.scrollTop = 790;
      fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);

      fireEvent.wheel(scrollbar, { deltaY: 50 });
      expect(viewport.scrollTop).toBe(800);
    });

    it('preventDefaults only when it consumes the scroll, allowing chaining at edges', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      // Mid-range: the wheel scroll is consumed, so the event is cancelled.
      viewport.scrollTop = 400;
      // `fireEvent` returns the `dispatchEvent` result: `false` when `preventDefault` was called.
      expect(fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(false);

      // At the end edge scrolling further: not consumed, so the event chains to the parent/page.
      viewport.scrollTop = 800;
      expect(fireEvent.wheel(scrollbar, { deltaY: 50 })).toBe(true);

      // At the start edge scrolling further backward, the event chains too.
      viewport.scrollTop = 0;
      expect(fireEvent.wheel(scrollbar, { deltaY: -50 })).toBe(true);
    });

    it('ignores zero-delta wheel events', async () => {
      const { viewport, scrollbar } = await renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(fireEvent.wheel(scrollbar, { deltaY: 0 })).toBe(true);
      flush();
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('does not intercept browser zoom gestures', async () => {
      const { viewport, scrollbar } = await renderWheelTest({
        orientation: 'vertical',
        scrollTop: 400,
      });

      expect(fireEvent.wheel(scrollbar, { ctrlKey: true, deltaY: 50 })).toBe(true);
      flush();
      expect(viewport.scrollTop).toBe(400);
      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });

    it('marks the scroll area as scrolling when wheeling over the scrollbar', async () => {
      const { scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      fireEvent.wheel(scrollbar, { deltaY: 50 });

      await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));
    });

    it('marks the scroll area as scrolling when wheeling over the horizontal scrollbar', async () => {
      const { scrollbar } = await renderWheelTest({ orientation: 'horizontal' });

      fireEvent.wheel(scrollbar, { deltaX: 50 });

      await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));
    });

    it('does not mark the scroll area as scrolling when chaining at an edge', async () => {
      const { viewport, scrollbar } = await renderWheelTest({ orientation: 'vertical' });

      // At the end edge scrolling further chains to the page without consuming the
      // scroll, so the area must not be marked as scrolling.
      viewport.scrollTop = 800;
      fireEvent.wheel(scrollbar, { deltaY: 50 });
      flush();

      expect(scrollbar).not.toHaveAttribute('data-scrolling');
    });
  });
});
