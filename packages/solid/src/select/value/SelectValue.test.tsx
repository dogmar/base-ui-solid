import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@solidjs/testing-library';
import { Select } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Select.Value />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders the raw value by default', async () => {
    render(() => (
      <Select.Root defaultValue="b">
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('b');
  });

  it('renders the label from the items map for the selected value', async () => {
    const items = {
      sans: 'Sans-serif',
      serif: 'Serif',
    };

    render(() => (
      <Select.Root defaultValue="serif" items={items}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('Serif');
  });

  it('renders the label from an items array for the selected value', async () => {
    const items = [
      { value: 'sans', label: 'Sans-serif' },
      { value: 'serif', label: 'Serif' },
    ];

    render(() => (
      <Select.Root defaultValue="sans" items={items}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('Sans-serif');
  });

  it('accepts a function child to format the value', async () => {
    render(() => (
      <Select.Root defaultValue="b">
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value">
            {(value: string | null) => (value ? `formatted: ${value}` : 'none')}
          </Select.Value>
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('formatted: b');
  });

  it('updates the function child output when the value changes', async () => {
    const user = userEvent.setup();
    render(() => (
      <Select.Root>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value">
            {(value: string | null) => (value ? `formatted: ${value}` : 'none')}
          </Select.Value>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    expect(screen.getByTestId('value')).toHaveTextContent('none');

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
    await user.click(screen.getByRole('option', { name: 'b' }));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('formatted: b');
  });

  describe('prop: placeholder', () => {
    it('renders the placeholder when no value is selected', async () => {
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select one…" />
          </Select.Trigger>
        </Select.Root>
      ));
      await flushMicrotasks();

      const value = screen.getByTestId('value');
      expect(value).toHaveTextContent('Select one…');
      expect(value).toHaveAttribute('data-placeholder', '');
    });

    it('is replaced by the selected value', async () => {
      render(() => (
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select one…" />
          </Select.Trigger>
        </Select.Root>
      ));
      await flushMicrotasks();

      const value = screen.getByTestId('value');
      expect(value).toHaveTextContent('b');
      expect(value).not.toHaveAttribute('data-placeholder');
    });
  });

  it('renders comma-separated labels for multiple selected values', async () => {
    const items = {
      a: 'Apple',
      b: 'Banana',
    };
    render(() => (
      <Select.Root multiple defaultValue={['a', 'b']} items={items}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('value')).toHaveTextContent('Apple, Banana');
  });
});
