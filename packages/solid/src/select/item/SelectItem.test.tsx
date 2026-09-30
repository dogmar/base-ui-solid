import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Select } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function TestSelect(props: {
  rootProps?: Select.Root.Props<string> | undefined;
  itemProps?: Partial<Select.Item.Props> | undefined;
}): JSX.Element {
  return (
    <Select.Root {...(props.rootProps ?? {})}>
      <Select.Trigger data-testid="trigger">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="a">a</Select.Item>
            <Select.Item value="b" {...(props.itemProps ?? {})}>
              b
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

describe('<Select.Item />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders options with the correct role and default aria-selected', async () => {
    render(() => <TestSelect />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).toHaveAttribute('aria-selected', 'false');
      expect(option).not.toHaveAttribute('data-selected');
    }
  });

  it('marks the selected item with aria-selected and data-selected', async () => {
    render(() => <TestSelect rootProps={{ defaultValue: 'b' }} />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const optionB = screen.getByRole('option', { name: 'b' });
    expect(optionB).toHaveAttribute('aria-selected', 'true');
    expect(optionB).toHaveAttribute('data-selected', '');

    const optionA = screen.getByRole('option', { name: 'a' });
    expect(optionA).toHaveAttribute('aria-selected', 'false');
    expect(optionA).not.toHaveAttribute('data-selected');
  });

  it('selects a value on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(() => <TestSelect rootProps={{ onValueChange }} />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    await user.click(screen.getByRole('option', { name: 'b' }));
    await flushMicrotasks();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('b');
  });

  describe('prop: disabled', () => {
    it('renders aria-disabled and data-disabled and blocks selection', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(() => <TestSelect rootProps={{ onValueChange }} itemProps={{ disabled: true }} />);

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      const optionB = screen.getByRole('option', { name: 'b' });
      expect(optionB).toHaveAttribute('aria-disabled', 'true');
      expect(optionB).toHaveAttribute('data-disabled', '');

      await user.click(optionB);
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: label', () => {
    it('is used for typeahead matching instead of the text content', async () => {
      const user = userEvent.setup();
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a" label="Apple">
                  first
                </Select.Item>
                <Select.Item value="b" label="Banana">
                  second
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      (screen.getByRole('listbox') as HTMLElement).focus();
      await user.keyboard('Ban');
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'second' })).toHaveAttribute(
        'data-highlighted',
        '',
      );
    });
  });

  it('highlights the item on hover by default', async () => {
    const user = userEvent.setup();
    render(() => <TestSelect />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const optionB = screen.getByRole('option', { name: 'b' });
    await user.hover(optionB);
    await flushMicrotasks();

    expect(optionB).toHaveAttribute('data-highlighted', '');
  });

  it('does not highlight the item on hover when highlightItemOnHover is false', async () => {
    const user = userEvent.setup();
    render(() => <TestSelect rootProps={{ highlightItemOnHover: false }} />);

    fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();

    const optionB = screen.getByRole('option', { name: 'b' });
    await user.hover(optionB);
    await flushMicrotasks();

    expect(optionB).not.toHaveAttribute('data-highlighted');
  });
});
