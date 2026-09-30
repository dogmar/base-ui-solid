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

describe('<Select.Group />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders a group labelled by its group label', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Group data-testid="group">
                <Select.GroupLabel data-testid="group-label">Fruits</Select.GroupLabel>
                <Select.Item value="a">Apple</Select.Item>
                <Select.Item value="b">Banana</Select.Item>
              </Select.Group>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const group = screen.getByTestId('group');
    const label = screen.getByTestId('group-label');

    expect(group).toHaveAttribute('role', 'group');
    expect(label.id).not.toBe('');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
  });
});
