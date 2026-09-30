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

describe.skipIf(!isJSDOM)('<Tooltip.Positioner />', () => {
  it('throws a descriptive error when rendered outside <Tooltip.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Positioner />)).toThrow(
        'Base UI: TooltipRootContext is missing. Tooltip parts must be placed within <Tooltip.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <Tooltip.Portal>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tooltip.Root open>
            <Tooltip.Positioner />
          </Tooltip.Root>
        )),
      ).toThrow('Base UI: <Tooltip.Portal> is missing.');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('applies side and align data attributes reflecting the configured placement', async () => {
    render(() => (
      <Tooltip.Root open>
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner" side="bottom" align="start">
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-open');
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(positioner).toHaveAttribute('data-align', 'start');
    expect(positioner).toHaveAttribute('role', 'presentation');
  });

  it('is hidden while the tooltip is closed and kept mounted', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
        <Tooltip.Portal keepMounted>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('hidden');
    expect(positioner).toHaveAttribute('data-closed');
  });
});
