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

describe('<Select.GroupLabel />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders an aria-hidden label element', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Group>
                <Select.GroupLabel data-testid="group-label">Fruits</Select.GroupLabel>
                <Select.Item value="a">Apple</Select.Item>
              </Select.Group>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const label = screen.getByTestId('group-label');
    expect(label).toHaveAttribute('aria-hidden', 'true');
    expect(label).toHaveTextContent('Fruits');
  });

  it('respects an explicit id', async () => {
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Group data-testid="group">
                <Select.GroupLabel data-testid="group-label" id="fruits-label">
                  Fruits
                </Select.GroupLabel>
                <Select.Item value="a">Apple</Select.Item>
              </Select.Group>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    expect(screen.getByTestId('group-label').id).toBe('fruits-label');
    expect(screen.getByTestId('group')).toHaveAttribute('aria-labelledby', 'fruits-label');
  });
});
