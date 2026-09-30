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

describe('<Select.ItemIndicator />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders only inside the selected item', async () => {
    render(() => (
      <Select.Root defaultValue="b">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">
                <Select.ItemText>a</Select.ItemText>
                <Select.ItemIndicator data-testid="indicator-a" />
              </Select.Item>
              <Select.Item value="b">
                <Select.ItemText>b</Select.ItemText>
                <Select.ItemIndicator data-testid="indicator-b" />
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(screen.queryByTestId('indicator-a')).toBeNull();
    const indicatorB = screen.getByTestId('indicator-b');
    expect(indicatorB).toHaveAttribute('aria-hidden', 'true');
  });

  it('stays in the DOM with keepMounted', async () => {
    render(() => (
      <Select.Root defaultValue="b">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">
                <Select.ItemText>a</Select.ItemText>
                <Select.ItemIndicator data-testid="indicator-a" keepMounted />
              </Select.Item>
              <Select.Item value="b">
                <Select.ItemText>b</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(screen.getByTestId('indicator-a')).not.toBeNull();
  });
});
