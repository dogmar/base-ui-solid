import { expect } from 'vitest';
import { flush } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { NumberField } from '../index';

function createPointerDownEvent(elm: HTMLElement) {
  const box = elm.getBoundingClientRect();
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  return new PointerEvent('pointerdown', {
    bubbles: true,
    clientX: centerX,
    clientY: centerY,
  });
}

// The scrubbing interaction itself relies on pointer lock and pointer movement, which jsdom
// cannot emulate; those suites are Chromium/Firefox-only in the React port and are not ported.
describe('<NumberField.ScrubArea />', () => {
  it('has presentation role', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  describe('touch input', () => {
    function createTouch(target: EventTarget) {
      if (typeof Touch === 'function') {
        return new Touch({ identifier: 1, target, clientX: 0, clientY: 0 });
      }
      return { clientX: 0, clientY: 0 };
    }

    async function renderScrubArea() {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" />
        </NumberField.Root>
      ));
      // The touch-prevent listener is attached in a post-render effect.
      flush();
      await Promise.resolve();
      flush();
      return { scrubArea: screen.getByTestId('scrub-area') };
    }

    it('blocks scrolling for a single-touch scrub', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = fireEvent.touchStart(scrubArea, {
        touches: [createTouch(scrubArea)],
      });
      expect(notCanceled).toBe(false);
    });

    it('leaves multi-touch gestures such as pinch-zoom to the browser', async () => {
      const { scrubArea } = await renderScrubArea();
      const notCanceled = fireEvent.touchStart(scrubArea, {
        touches: [createTouch(scrubArea), createTouch(scrubArea)],
      });
      expect(notCanceled).toBe(true);
    });
  });

  describe('pointerdown guards', () => {
    function renderScrubArea(props?: NumberField.Root.Props) {
      render(() => (
        <NumberField.Root defaultValue={0} data-testid="root" {...props}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));
      return {
        scrubArea: screen.getByTestId('scrub-area'),
        root: screen.getByTestId('root'),
      };
    }

    it('ignores non-primary pointer buttons', async () => {
      const { scrubArea, root } = renderScrubArea();

      scrubArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 1 }));
      flush();
      await Promise.resolve();
      flush();

      expect(root).not.toHaveAttribute('data-scrubbing');
    });

    it('does not start scrubbing when the field is read-only', async () => {
      const { scrubArea, root } = renderScrubArea({ readOnly: true });

      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      flush();
      await Promise.resolve();
      flush();

      expect(root).not.toHaveAttribute('data-scrubbing');
    });
  });
});
