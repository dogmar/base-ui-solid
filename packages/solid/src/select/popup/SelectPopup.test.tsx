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

describe('<Select.Popup />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders the listbox role and links it to the root id', async () => {
    render(() => (
      <Select.Root id="font-select">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'listbox');
    expect(popup.id).toBe('font-select-list');
  });

  it('is aria-multiselectable in multiple mode', async () => {
    render(() => (
      <Select.Root multiple>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('exposes open state and side data attributes', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-open', '');
    expect(popup).toHaveAttribute('data-side');
  });

  it('applies transition status attributes while animating', async () => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = false;
    try {
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup data-testid="popup">
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      flush();

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveAttribute('data-starting-style', '');
      expect(popup).toHaveAttribute('data-open', '');
    } finally {
      (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
    }
  });
});
