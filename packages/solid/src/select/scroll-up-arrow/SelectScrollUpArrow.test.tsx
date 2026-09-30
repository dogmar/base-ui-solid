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

describe('<Select.ScrollUpArrow />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('does not render while the popup is not scrollable', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.ScrollUpArrow data-testid="scroll-up" />
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    // jsdom has no layout, so the popup never becomes scrollable.
    expect(screen.queryByTestId('scroll-up')).toBeNull();
  });

  it('renders with keepMounted and exposes direction data attributes', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.ScrollUpArrow data-testid="scroll-up" keepMounted />
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const arrow = screen.getByTestId('scroll-up');
    expect(arrow).toHaveAttribute('data-direction', 'up');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).not.toHaveAttribute('data-visible');
  });
});
