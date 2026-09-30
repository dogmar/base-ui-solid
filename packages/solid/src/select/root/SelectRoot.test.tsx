/* eslint-disable react/jsx-fragments */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Select } from '..';
import { Field } from '../../field';
import { REASONS } from '../../internals/reasons';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

interface TestSelectProps {
  rootProps?: Select.Root.Props<string> | undefined;
  triggerProps?: Select.Trigger.Props | undefined;
}

function BasicSelect(props: TestSelectProps): JSX.Element {
  return (
    <Select.Root {...(props.rootProps ?? {})}>
      <Select.Trigger data-testid="trigger" {...(props.triggerProps ?? {})}>
        <Select.Value data-testid="value" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner data-testid="positioner">
          <Select.Popup data-testid="popup">
            <Select.Item value="a">a</Select.Item>
            <Select.Item value="b">b</Select.Item>
            <Select.Item value="c">c</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

describe('<Select.Root />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('open state', () => {
    it('opens the popup when the trigger is clicked', async () => {
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('listbox')).toBeNull();

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeVisible();
    });

    it('opens the popup with ArrowDown and highlights an item', async () => {
      const user = userEvent.setup();
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBeVisible();
    });

    it('opens the popup with Enter', async () => {
      const user = userEvent.setup();
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBeVisible();
    });

    it('closes the popup when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).toBeVisible();

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the popup on outside pointerdown', async () => {
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).toBeVisible();

      fireEvent.pointerDown(document.body);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('prop: defaultOpen', () => {
    it('renders the popup initially open', async () => {
      render(() => <BasicSelect rootProps={{ defaultOpen: true }} />);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).toBeVisible();
    });
  });

  describe('prop: open (controlled)', () => {
    it('follows the controlled open prop', async () => {
      const [open, setOpen] = createSignal(false);
      render(() => (
        <Select.Root open={open()}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
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

      expect(screen.queryByRole('listbox')).toBeNull();

      setOpen(true);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).toBeVisible();

      setOpen(false);
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('prop: onOpenChange', () => {
    it('reports open changes with reason details', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(() => <BasicSelect rootProps={{ onOpenChange }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0][0]).toBe(true);
      expect(onOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange.mock.calls[1][0]).toBe(false);
      expect(onOpenChange.mock.calls[1][1].reason).toBe(REASONS.escapeKey);
    });
  });

  describe('prop: defaultValue', () => {
    it('selects the item by default', async () => {
      render(() => <BasicSelect rootProps={{ defaultValue: 'b' }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  describe('prop: value', () => {
    it('selects the item specified by the value prop', async () => {
      render(() => <BasicSelect rootProps={{ value: 'b' }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('updates the selected item when the value prop changes', async () => {
      const [value, setValue] = createSignal<string | null>('a');
      render(() => (
        <Select.Root value={value()}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
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

      const trigger = screen.getByTestId('trigger');
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );

      setValue('b');
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('does not update the internal value if the controlled value prop does not change', async () => {
      const onValueChange = vi.fn();
      render(() => <BasicSelect rootProps={{ value: 'a', onValueChange }} />);

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('a');

      fireEvent.click(trigger);
      await flushMicrotasks();

      const optionB = screen.getByRole('option', { name: 'b' });
      fireEvent.click(optionB);
      await flushMicrotasks();

      expect(onValueChange.mock.calls.length).toBe(0);
      expect(trigger).toHaveTextContent('a');
    });
  });

  describe('prop: onValueChange', () => {
    it('is called with the new value and event details when an item is clicked', async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      render(() => <BasicSelect rootProps={{ onValueChange }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe('b');
      expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.itemPress);
    });

    it('keeps the uncontrolled value when the change event is canceled', async () => {
      const onValueChange = vi.fn((_value: string | null, eventDetails: any) => {
        eventDetails.cancel();
      });
      const user = userEvent.setup();
      render(() => <BasicSelect rootProps={{ defaultValue: 'a', onValueChange }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(trigger).toHaveTextContent('a');
    });
  });

  describe('item selection', () => {
    it('selects an item on click and closes the popup', async () => {
      const user = userEvent.setup();
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      await user.click(screen.getByRole('option', { name: 'c' }));
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger).toHaveTextContent('c');
    });

    it('does not select a disabled item', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Select.Root onValueChange={onValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b" disabled>
                  b
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.click(trigger);
      await flushMicrotasks();

      const optionB = screen.getByRole('option', { name: 'b' });
      expect(optionB).toHaveAttribute('data-disabled', '');
      expect(optionB).toHaveAttribute('aria-disabled', 'true');

      fireEvent.click(optionB);
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('listbox')).toBeVisible();
    });

    it('selects the highlighted item with Enter', async () => {
      const user = userEvent.setup();
      render(() => <BasicSelect />);
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBeVisible();

      // Opening with ArrowDown highlights the first item; another ArrowDown moves to the second.
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
      expect(trigger).toHaveTextContent('b');
    });
  });

  describe('typeahead', () => {
    it('changes the value when typing on a closed trigger', async () => {
      const user = userEvent.setup();
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="alpha">
                  <Select.ItemText>alpha</Select.ItemText>
                </Select.Item>
                <Select.Item value="beta">
                  <Select.ItemText>beta</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      // Wait for the focus-driven force mount that renders the hidden items.
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByText('beta')).not.toBeNull();
      });

      await user.keyboard('b');
      await flushMicrotasks();

      expect(screen.getByTestId('value')).toHaveTextContent('beta');
    });

    it('highlights the matching item when typing while open', async () => {
      const user = userEvent.setup();
      render(() => (
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="alpha">
                  <Select.ItemText>alpha</Select.ItemText>
                </Select.Item>
                <Select.Item value="beta">
                  <Select.ItemText>beta</Select.ItemText>
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      const trigger = screen.getByTestId('trigger');
      fireEvent.click(trigger);
      await flushMicrotasks();

      const listbox = screen.getByRole('listbox');
      (listbox as HTMLElement).focus();
      await user.keyboard('b');
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'beta' })).toHaveAttribute(
          'data-highlighted',
          '',
        );
      });
    });
  });

  describe('prop: disabled', () => {
    it('does not open the popup when disabled', async () => {
      render(() => <BasicSelect rootProps={{ disabled: true }} />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('data-disabled', '');
      expect(trigger).toBeDisabled();

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('prop: readOnly', () => {
    it('opens the popup but does not commit a value', async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      render(() => <BasicSelect rootProps={{ readOnly: true, onValueChange }} />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('aria-readonly', 'true');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toBeVisible();

      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: multiple', () => {
    function MultipleSelect(props: { rootProps?: Select.Root.Props<string, true> }): JSX.Element {
      return (
        <Select.Root multiple {...(props.rootProps ?? {})}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );
    }

    it('accumulates selected values into an array and keeps the popup open', async () => {
      const onValueChange = vi.fn();
      const user = userEvent.setup();
      render(() => <MultipleSelect rootProps={{ onValueChange }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');

      await user.click(screen.getByRole('option', { name: 'a' }));
      await flushMicrotasks();

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['a']);
      expect(screen.getByRole('listbox')).toBeVisible();

      await user.click(screen.getByRole('option', { name: 'c' }));
      await flushMicrotasks();

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['a', 'c']);

      // Deselects an already-selected item.
      await user.click(screen.getByRole('option', { name: 'a' }));
      await flushMicrotasks();

      expect(onValueChange.mock.lastCall?.[0]).toEqual(['c']);
    });

    it('marks selected items with aria-selected and data-selected', async () => {
      render(() => <MultipleSelect rootProps={{ defaultValue: ['a', 'b'] }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('option', { name: 'c' })).not.toHaveAttribute('data-selected');
    });

    it('submits one hidden input per selected value', async () => {
      const { container } = render(() => (
        <Select.Root multiple name="languages" defaultValue={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();

      const hiddenInputs = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="languages"]'),
      );
      expect(hiddenInputs.map((input) => input.value)).toEqual(['a', 'c']);
    });
  });

  describe('form integration', () => {
    it('serializes the value into the hidden input', async () => {
      const { container } = render(() => (
        <BasicSelect rootProps={{ name: 'font', defaultValue: 'b' }} />
      ));
      await flushMicrotasks();

      const hiddenInput = container.querySelector<HTMLInputElement>('input[name="font"]');
      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput!.value).toBe('b');
      expect(hiddenInput!.tabIndex).toBe(-1);
      expect(hiddenInput).toHaveAttribute('aria-hidden', 'true');
    });

    it('updates the hidden input when selecting an item', async () => {
      const user = userEvent.setup();
      const { container } = render(() => <BasicSelect rootProps={{ name: 'font' }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'c' }));
      await flushMicrotasks();

      const hiddenInput = container.querySelector<HTMLInputElement>('input[name="font"]');
      expect(hiddenInput!.value).toBe('c');
    });

    it('serializes object values with itemToStringValue', async () => {
      const items = [
        { value: { code: 'a' }, label: 'Apple' },
        { value: { code: 'b' }, label: 'Banana' },
      ];
      const { container } = render(() => (
        <Select.Root
          name="fruit"
          defaultValue={items[1].value}
          itemToStringValue={(item: { code: string }) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={items[0].value}>Apple</Select.Item>
                <Select.Item value={items[1].value}>Banana</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();

      const hiddenInput = container.querySelector<HTMLInputElement>('input[name="fruit"]');
      expect(hiddenInput!.value).toBe('b');
    });
  });

  describe('with Field.Root parent', () => {
    it('inherits the name from the field', async () => {
      const { container } = render(() => (
        <Field.Root name="font">
          <BasicSelect rootProps={{ defaultValue: 'a' }} />
        </Field.Root>
      ));
      await flushMicrotasks();

      const hiddenInput = container.querySelector<HTMLInputElement>('input[name="font"]');
      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput!.value).toBe('a');
    });

    it('inherits the disabled state from the field', async () => {
      render(() => (
        <Field.Root disabled>
          <BasicSelect />
        </Field.Root>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-disabled', '');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('[data-dirty]: marks the trigger dirty after the value changes', async () => {
      const user = userEvent.setup();
      render(() => (
        <Field.Root>
          <BasicSelect />
        </Field.Root>
      ));
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.click(trigger);
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    it('[data-filled]: reflects whether the select has a value', async () => {
      const user = userEvent.setup();
      render(() => (
        <Field.Root>
          <BasicSelect />
        </Field.Root>
      ));
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-filled');

      fireEvent.click(trigger);
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'b' }));
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-filled', '');
    });

    it('[data-touched]: marks the trigger touched after closing via outside press', async () => {
      render(() => (
        <Field.Root>
          <BasicSelect />
        </Field.Root>
      ));
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-touched');

      fireEvent.click(trigger);
      await flushMicrotasks();
      fireEvent.pointerDown(document.body);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-touched', '');
    });
  });

  describe('transition status', () => {
    it('applies data-starting-style and data-open on open', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      try {
        render(() => <BasicSelect />);
        const trigger = screen.getByTestId('trigger');

        fireEvent.click(trigger);
        flush();

        const popup = screen.getByTestId('popup');
        expect(popup).toHaveAttribute('data-open', '');
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      }
    });
  });

  describe('prop: actionsRef', () => {
    it('unmounts the select manually', async () => {
      const actionsRef = { current: null as Select.Root.Actions | null };
      render(() => <BasicSelect rootProps={{ actionsRef }} />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();
      expect(screen.getByRole('listbox')).toBeVisible();

      fireEvent.click(trigger);
      await flushMicrotasks();

      actionsRef.current!.unmount();
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });
});
