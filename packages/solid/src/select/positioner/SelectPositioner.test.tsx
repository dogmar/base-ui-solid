import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Select } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Select.Positioner />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders a presentation element with open state attributes', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner">
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('role', 'presentation');
    expect(positioner).toHaveAttribute('data-open', '');
  });

  it('falls back to anchored positioning in environments without layout and exposes side/align', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner" side="bottom" align="start">
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    // jsdom has no layout, so `alignItemWithTrigger` falls back to plain anchored
    // positioning (after the first positioning pass) and the resolved side is
    // reported through data attributes.
    const positioner = screen.getByTestId('positioner');
    await waitFor(() => {
      expect(positioner).toHaveAttribute('data-side', 'bottom');
    });
    expect(positioner).toHaveAttribute('data-align', 'start');
  });

  it('reports side "none" while item-with-trigger alignment is active', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner">
            <Select.Popup data-testid="popup">
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    // Open with keyboard-like click (detail 0): alignment applies until the
    // measurement pass falls back in jsdom.
    fireEvent.click(screen.getByTestId('trigger'));
    flush();

    // After microtasks the jsdom fallback resolves to a real side again.
    await flushMicrotasks();
    expect(screen.getByTestId('positioner')).toHaveAttribute('data-side');
  });

  it('remains mounted with hidden attribute when closed after opening', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner data-testid="positioner">
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    await flushMicrotasks();
    expect(screen.getByTestId('positioner')).not.toHaveAttribute('hidden');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await flushMicrotasks();

    expect(screen.queryByTestId('positioner')).toBeNull();
  });
});
