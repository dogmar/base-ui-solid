import { createSignal, flush } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Field } from '../field';
import { Input } from './Input';

describe('<Input />', () => {
  it('renders an input element', () => {
    render(() => <Input data-testid="input" />);
    expect(screen.getByTestId('input').tagName).toBe('INPUT');
  });

  it('forwards the ref to the input element', () => {
    const ref = { current: null as HTMLElement | null };
    render(() => <Input data-testid="input" ref={ref} />);
    expect(ref.current).toBe(screen.getByTestId('input'));
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  describe('uncontrolled', () => {
    it('applies the defaultValue to the input', () => {
      render(() => <Input defaultValue="hello" />);
      expect(screen.getByRole('textbox')).toHaveValue('hello');
    });

    it('keeps user-typed text without a value prop', () => {
      render(() => <Input defaultValue="hello" />);

      const input = screen.getByRole('textbox');
      fireEvent.input(input, { target: { value: 'world' } });
      flush();

      expect(input).toHaveValue('world');
    });
  });

  describe('controlled', () => {
    it('renders the controlled value', () => {
      const [value] = createSignal('initial');
      render(() => <Input value={value()} />);
      expect(screen.getByRole('textbox')).toHaveValue('initial');
    });

    it('updates when the controlled value changes programmatically', () => {
      const [value, setValue] = createSignal('a');
      render(() => <Input value={value()} />);

      setValue('b');
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('b');
    });

    it('syncs user input through onValueChange', () => {
      const [value, setValue] = createSignal('');
      render(() => <Input value={value()} onValueChange={setValue} />);

      const input = screen.getByRole('textbox');
      fireEvent.input(input, { target: { value: 'abc' } });
      flush();

      expect(value()).toBe('abc');
      expect(input).toHaveValue('abc');
    });
  });

  describe('prop: onValueChange', () => {
    it('is called with the input value and event details', () => {
      const onValueChange = vi.fn();

      render(() => <Input onValueChange={onValueChange} />);

      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('abc');
      expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
      expect(onValueChange.mock.lastCall?.[1].event).toBeInstanceOf(Event);
    });
  });

  describe('field state data attributes', () => {
    it('reflects focused, dirty, filled, and touched states inside Field.Root', () => {
      render(() => (
        <Field.Root>
          <Input data-testid="input" />
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-focused');
      expect(input).not.toHaveAttribute('data-dirty');
      expect(input).not.toHaveAttribute('data-filled');
      expect(input).not.toHaveAttribute('data-touched');

      fireEvent.focus(input);
      flush();
      expect(input).toHaveAttribute('data-focused', '');

      fireEvent.input(input, { target: { value: 'a' } });
      flush();
      expect(input).toHaveAttribute('data-dirty', '');
      expect(input).toHaveAttribute('data-filled', '');

      fireEvent.blur(input);
      flush();
      expect(input).not.toHaveAttribute('data-focused');
      expect(input).toHaveAttribute('data-touched', '');
    });

    it('reflects the disabled state', () => {
      render(() => <Input data-testid="input" disabled />);

      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('data-disabled', '');
    });

    it('reflects validity on the Field.Root state', () => {
      render(() => (
        <Field.Root data-testid="root" validationMode="onChange" validate={() => 'error'}>
          <Input data-testid="input" />
        </Field.Root>
      ));

      fireEvent.input(screen.getByTestId('input'), { target: { value: 'a' } });
      flush();

      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('uses the Field.Root name over its own', () => {
    render(() => (
      <Field.Root name="root-name">
        <Input data-testid="input" name="input-name" />
      </Field.Root>
    ));

    expect(screen.getByTestId('input')).toHaveAttribute('name', 'root-name');
  });
});
