import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Select } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Select.Portal />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('does not render its content while closed', async () => {
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
    await flushMicrotasks();

    expect(screen.queryByTestId('positioner')).toBeNull();
  });

  it('renders its content into the document body when open', async () => {
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
    expect(positioner).not.toBeNull();
    expect(document.body.contains(positioner)).toBe(true);
  });

  it('renders into a custom container', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    try {
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal container={container}>
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

      expect(container.contains(screen.getByTestId('positioner'))).toBe(true);
    } finally {
      container.remove();
    }
  });
});
