import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Root />', () => {
  describe('data-scrolling attribute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds [data-scrolling] attribute when viewport is scrolled', () => {
      render(() => (
        <ScrollArea.Root data-testid="root" style={{ width: '200px', height: '200px' }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: '1000px', height: '1000px' }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>
      ));
      flush();

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      expect(root).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });
      flush();

      expect(root).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(root).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });
      flush();

      expect(root).toHaveAttribute('data-scrolling', '');

      vi.advanceTimersByTime(SCROLL_TIMEOUT);
      flush();

      expect(root).not.toHaveAttribute('data-scrolling');
    });
  });
});
