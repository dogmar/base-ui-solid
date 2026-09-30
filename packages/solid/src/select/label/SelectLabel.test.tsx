import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Select } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Select.Label />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('labels the trigger', async () => {
    render(() => (
      <Select.Root>
        <Select.Label data-testid="label">Font</Select.Label>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    const label = screen.getByTestId('label');
    const trigger = screen.getByTestId('trigger');

    expect(label).toHaveTextContent('Font');
    expect(trigger).toHaveAttribute('aria-labelledby', label.id);
  });

  it('focuses the trigger when the label is clicked', async () => {
    const user = userEvent.setup();
    render(() => (
      <Select.Root>
        <Select.Label data-testid="label">Font</Select.Label>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    await user.click(screen.getByTestId('label'));
    await flushMicrotasks();

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });
});
