import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Thumb />', () => {
  it('throws a descriptive error when rendered outside <ScrollArea.Scrollbar>', () => {
    expect(() =>
      render(() => (
        <ScrollArea.Root>
          <ScrollArea.Thumb />
        </ScrollArea.Root>
      )),
    ).toThrow(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  });

  it('handles a thumb gesture when no viewport is mounted', () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    flush();

    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });
    flush();

    // Without a viewport there is nothing to scroll, so the drag never consumes the move.
    expect(thumb).not.toHaveAttribute('data-scrolling');
    expect(thumb.style.transform).toBe('');

    fireEvent.pointerUp(thumb, { pointerId: 1 });
    flush();
    expect(thumb).not.toHaveAttribute('data-scrolling');
  });

  it('handles the scrollbar unmounting from a user pointer-move callback', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport data-testid="viewport" />
        <Show when={mounted()}>
          <ScrollArea.Scrollbar keepMounted data-testid="scrollbar">
            <ScrollArea.Thumb
              data-testid="thumb"
              onPointerMove={() => {
                setMounted(false);
                flush();
              }}
            />
          </ScrollArea.Scrollbar>
        </Show>
      </ScrollArea.Root>
    ));
    flush();

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperty(thumb, 'setPointerCapture', {
      configurable: true,
      value: () => {},
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(() =>
      fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 }),
    ).not.toThrow();
    flush();

    expect(screen.queryByTestId('scrollbar')).toBe(null);
    expect(viewport.scrollTop).toBe(0);
  });

  it('handles the viewport unmounting from a user pointer-up callback', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <Show when={mounted()}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ 'scroll-snap-type': 'y mandatory' }}
          />
        </Show>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb
            data-testid="thumb"
            onPointerUp={() => {
              setMounted(false);
              flush();
            }}
          />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    flush();

    const viewport = screen.getByTestId('viewport');
    const thumb = screen.getByTestId('thumb');
    Object.defineProperties(thumb, {
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    expect(viewport.style.scrollSnapType).toBe('none');

    expect(() => fireEvent.pointerUp(thumb, { pointerId: 1 })).not.toThrow();
    flush();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  it('clears scrolling state on pointer cancel without releasing stale capture', async () => {
    render(() => (
      <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: '200px', height: '1000px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    flush();

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
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

    Object.defineProperties(scrollbar, {
      offsetHeight: {
        configurable: true,
        value: 200,
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
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1, buttons: 1 });

    await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();

    await waitFor(() => expect(scrollbar).not.toHaveAttribute('data-scrolling'));
  });

  it('clears horizontal scrolling state on pointer cancel', async () => {
    render(() => (
      <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: '1000px', height: '200px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    ));
    flush();

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
    const thumb = screen.getByTestId('thumb');

    Object.defineProperties(viewport, {
      clientWidth: {
        configurable: true,
        value: 200,
      },
      scrollWidth: {
        configurable: true,
        value: 1000,
      },
      scrollLeft: {
        configurable: true,
        writable: true,
        value: 0,
      },
    });

    Object.defineProperties(scrollbar, {
      offsetWidth: {
        configurable: true,
        value: 200,
      },
    });

    Object.defineProperties(thumb, {
      offsetWidth: {
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
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 20, pointerId: 1, buttons: 1 });

    await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();

    await waitFor(() => expect(scrollbar).not.toHaveAttribute('data-scrolling'));
  });

  describe('scroll snap', () => {
    function defineThumbPointerCapture(thumb: HTMLElement) {
      let capturedId: number | null = null;
      Object.defineProperties(thumb, {
        setPointerCapture: {
          configurable: true,
          value: (pointerId: number) => {
            capturedId = pointerId;
          },
        },
        hasPointerCapture: {
          configurable: true,
          value: (pointerId: number) => pointerId === capturedId,
        },
        releasePointerCapture: {
          configurable: true,
          value: (pointerId: number) => {
            if (pointerId === capturedId) {
              capturedId = null;
            }
          },
        },
      });
      return {
        dropCapture() {
          capturedId = null;
        },
      };
    }

    function renderWithSnap() {
      render(() => (
        <ScrollArea.Root style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport
            data-testid="viewport"
            style={{ width: '100%', height: '100%', 'scroll-snap-type': 'y mandatory' }}
          >
            <div style={{ width: '200px', height: '1000px' }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();
    }

    it('disables viewport scroll snap while dragging and restores it on release', () => {
      renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('restores viewport scroll snap on pointer cancel', () => {
      renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerCancel(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores a second pointer while a drag is active', () => {
      renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      defineThumbPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('none');

      fireEvent.pointerUp(thumb, { pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('lets a new pointer take over when capture was silently dropped', () => {
      renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      const capture = defineThumbPointerCapture(thumb);

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
      expect(viewport.style.scrollSnapType).toBe('none');

      // The browser dropped capture without delivering `pointerup` or
      // `pointercancel`, and the contact's id never reappears (e.g. a lost
      // touch), so a new pointer must be able to take over the latched drag.
      capture.dropCapture();

      fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 2 });
      fireEvent.pointerUp(thumb, { pointerId: 2 });
      expect(viewport.style.scrollSnapType).toBe('y mandatory');
    });

    it('ignores non-primary pointer presses', () => {
      renderWithSnap();

      const viewport = screen.getByTestId('viewport');
      const thumb = screen.getByTestId('thumb');
      const setPointerCapture = vi.fn();
      Object.defineProperty(thumb, 'setPointerCapture', {
        configurable: true,
        value: setPointerCapture,
      });

      fireEvent.pointerDown(thumb, { button: 2, clientY: 0, pointerId: 1 });

      expect(viewport.style.scrollSnapType).toBe('y mandatory');
      expect(setPointerCapture).not.toHaveBeenCalled();
    });
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
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="vertical" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
            <ScrollArea.Thumb data-testid="horizontal" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ));
      flush();

      const verticalThumb = screen.getByTestId('vertical');
      const horizontalThumb = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(SCROLL_TIMEOUT - 2);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      vi.advanceTimersByTime(1);
      flush();

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');
    });
  });
});
