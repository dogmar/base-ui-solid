import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Select } from '..';
import { Field } from '../../field';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function TestSelect(props: {
  rootProps?: Select.Root.Props<string> | undefined;
  triggerProps?: Select.Trigger.Props | undefined;
}): JSX.Element {
  return (
    <Select.Root {...(props.rootProps ?? {})}>
      <Select.Trigger data-testid="trigger" {...(props.triggerProps ?? {})}>
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
  );
}

describe('<Select.Trigger />', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe('ARIA wiring', () => {
    it('renders a combobox button with listbox popup semantics', async () => {
      render(() => <TestSelect />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('references the listbox with aria-controls while open', async () => {
      render(() => <TestSelect />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-controls');

      fireEvent.click(trigger);
      await flushMicrotasks();

      const listbox = screen.getByRole('listbox');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', listbox.id);
    });

    it('sets aria-required and aria-readonly from the root', async () => {
      render(() => <TestSelect rootProps={{ required: true, readOnly: true }} />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('aria-required', 'true');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
    });
  });

  describe('state attributes', () => {
    it('has data-popup-open and data-pressed while open', async () => {
      render(() => <TestSelect />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-popup-open');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open', '');
      expect(trigger).toHaveAttribute('data-pressed', '');
    });

    it('has data-placeholder until a value is selected', async () => {
      render(() => <TestSelect />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('data-placeholder', '');
    });

    it('does not have data-placeholder when a value is selected', async () => {
      render(() => <TestSelect rootProps={{ defaultValue: 'a' }} />);
      await flushMicrotasks();

      expect(screen.getByTestId('trigger')).not.toHaveAttribute('data-placeholder');
    });

    it('exposes the popup side once positioned', async () => {
      render(() => <TestSelect />);
      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-side', 'bottom');
    });
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      render(() => <TestSelect triggerProps={{ disabled: true }} />);
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toBeDisabled();
      expect(trigger).toHaveAttribute('data-disabled', '');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('prop: id', () => {
    it('uses the explicit id over the generated one', async () => {
      render(() => <TestSelect triggerProps={{ id: 'my-trigger' }} />);
      expect(screen.getByTestId('trigger').id).toBe('my-trigger');
    });
  });

  describe('label association', () => {
    it('is labelled by Select.Label via aria-labelledby', async () => {
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

      expect(label.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-labelledby', label.id);
    });

    it('is labelled by Field.Label when inside a field', async () => {
      render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <TestSelect />
        </Field.Root>
      ));
      await flushMicrotasks();

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('aria-labelledby', label.id);
    });
  });
});
