import { describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';
import type { TooltipRoot } from '../root/TooltipRoot';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Tooltip.Trigger />', () => {
  it('throws a descriptive error when rendered without a root or a handle', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tooltip.Trigger>Trigger</Tooltip.Trigger>)).toThrow(
        'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('removes `data-popup-open` as soon as `open` becomes false', async () => {
    function TooltipWithPreventedUnmount() {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });

      return (
        <Tooltip.Root
          open={open()}
          onOpenChange={(nextOpen: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => {
            if (!nextOpen) {
              eventDetails.preventUnmountOnClose();
            }
            setOpen(nextOpen);
          }}
        >
          <Tooltip.Trigger
            data-testid="trigger"
            delay={0}
            closeDelay={0}
            style={{ 'pointer-events': 'none' }}
          >
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      );
    }

    render(() => <TooltipWithPreventedUnmount />);
    await settle();
    const trigger = screen.getByTestId('trigger');

    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    await settle();
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);

    fireEvent.mouseLeave(trigger);
    await settle();
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('opens when the rendered trigger element has its own id', async () => {
    render(() => (
      <Tooltip.Root>
        <Tooltip.Trigger
          delay={0}
          closeDelay={0}
          render={(props) => <button {...props} id="custom-button" data-testid="trigger" />}
        >
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ));
    await settle();

    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('id', 'custom-button');

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBe(null);
    });
    // The active-trigger id is reassociated to the internal registration id by
    // `useImplicitActiveTrigger` on a later flush. Re-query the trigger: the
    // reassociation can re-create the rendered element.
    await waitFor(() => {
      expect(screen.getByTestId('trigger')).toHaveAttribute('data-popup-open');
    });
  });
});
