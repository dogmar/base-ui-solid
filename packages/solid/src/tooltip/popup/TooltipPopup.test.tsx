import { describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Tooltip.Popup />', () => {
  it('should render the children', async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('applies data-open and popup data attributes while open', async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'top');
    expect(popup).toHaveAttribute('data-align', 'center');
  });

  it('reports a descriptive error when rendered outside <Tooltip.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The popup is created lazily inside the portal, so the missing-context
    // error surfaces through the reactive system rather than synchronously
    // from `render` (unlike the React version's rejected render).
    try {
      render(() => (
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Popup />
          </Tooltip.Portal>
        </Tooltip.Root>
      ));
      await settle();

      const reported = errorSpy.mock.calls
        .flat()
        .map((value) => String(value))
        .join('\n');
      expect(reported).toContain(
        'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
