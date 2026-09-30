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

describe('<Select.List />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('takes over the listbox role from the popup', async () => {
    render(() => (
      <Select.Root id="font-select">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.List data-testid="list">
                <Select.Item value="a">a</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const popup = screen.getByTestId('popup');
    const list = screen.getByTestId('list');

    expect(popup).toHaveAttribute('role', 'presentation');
    expect(list).toHaveAttribute('role', 'listbox');
    expect(list.id).toBe('font-select-list');
  });

  it('is aria-multiselectable in multiple mode', async () => {
    render(() => (
      <Select.Root multiple>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List data-testid="list">
                <Select.Item value="a">a</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(screen.getByTestId('list')).toHaveAttribute('aria-multiselectable', 'true');
  });
});
