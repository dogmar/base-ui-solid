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

describe('<Select.Icon />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders an aria-hidden span with a default arrow', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
          <Select.Icon data-testid="icon" />
        </Select.Trigger>
      </Select.Root>
    ));

    const icon = screen.getByTestId('icon');
    expect(icon.tagName).toBe('SPAN');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveTextContent('▼');
  });

  it('reflects the open state with data-popup-open', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
          <Select.Icon data-testid="icon" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const icon = screen.getByTestId('icon');
    expect(icon).not.toHaveAttribute('data-popup-open');

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(icon).toHaveAttribute('data-popup-open', '');
  });
});
