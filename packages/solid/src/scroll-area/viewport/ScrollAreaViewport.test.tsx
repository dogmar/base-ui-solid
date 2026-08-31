import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Viewport />', () => {
  it('handles a user scroll callback unmounting the viewport', () => {
    const [mounted, setMounted] = createSignal(true);

    render(() => (
      <ScrollArea.Root>
        <Show when={mounted()}>
          <ScrollArea.Viewport
            data-testid="viewport"
            onScroll={() => {
              setMounted(false);
              flush();
            }}
          />
        </Show>
      </ScrollArea.Root>
    ));
    flush();

    expect(() => fireEvent.scroll(screen.getByTestId('viewport'))).not.toThrow();
    flush();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderScrollArea() {
      render(() => (
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));
      flush();
    }

    it('adds [data-scrolling] attribute when viewport is scrolled', () => {
      renderScrollArea();

      const viewport = screen.getByTestId('viewport');

      expect(viewport).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('ignores data-scrolling during programmatic scroll', () => {
      renderScrollArea();

      const viewport = screen.getByTestId('viewport');

      // No user interaction before the scroll event, as with `scrollTo()`.
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('adds [data-scrolling] in touch modality even when the gesture delivers no events', () => {
      renderScrollArea();

      const viewport = screen.getByTestId('viewport');

      // The initial touch is delivered normally and establishes touch modality.
      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      flush();

      // A touch that catches an in-flight momentum scroll or rubber-band
      // bounce is consumed natively by WebKit: no touch/pointer events fire
      // for the whole gesture, only scroll events after an arbitrary pause.
      vi.advanceTimersByTime(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('keeps ignoring programmatic scrolls in mouse modality', () => {
      renderScrollArea();

      const viewport = screen.getByTestId('viewport');

      fireEvent.pointerDown(viewport, { pointerType: 'mouse' });
      flush();

      vi.advanceTimersByTime(200);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('restores programmatic scroll suppression after modality flips back to mouse', () => {
      renderScrollArea();

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      fireEvent.pointerDown(viewport, { pointerType: 'touch' });
      flush();
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');

      // A mouse pointermove on the root (not the viewport, whose own
      // handlers mark user interaction) switches back to mouse modality.
      fireEvent.pointerMove(root, { pointerType: 'mouse' });
      flush();
      fireEvent.scroll(viewport, { target: { scrollTop: 2 } });
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });

    it('removes [data-scrolling] after timeout', () => {
      renderScrollArea();

      const viewport = screen.getByTestId('viewport');

      // Start scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait less than timeout - should still be scrolling
      vi.advanceTimersByTime(SCROLL_TIMEOUT - 1);
      flush();

      expect(viewport).toHaveAttribute('data-scrolling', '');

      // Wait for remaining timeout
      vi.advanceTimersByTime(1);
      flush();

      expect(viewport).not.toHaveAttribute('data-scrolling');
    });
  });

  it('throws a descriptive error when rendered outside <ScrollArea.Root>', () => {
    expect(() => render(() => <ScrollArea.Viewport />)).toThrow(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  });
});
