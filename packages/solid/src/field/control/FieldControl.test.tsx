import { createSignal, flush } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Field } from '../index';

describe('<Field.Control />', () => {
  it('renders an input with type="button" default omitted', () => {
    render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    expect(screen.getByTestId('control').tagName).toBe('INPUT');
  });

  it('forwards the name and id props', () => {
    render(() => (
      <Field.Root>
        <Field.Control data-testid="control" id="my-id" name="my-name" />
      </Field.Root>
    ));

    const control = screen.getByTestId('control');
    expect(control).toHaveAttribute('id', 'my-id');
    expect(control).toHaveAttribute('name', 'my-name');
  });

  it('uses the Field.Root name over its own', () => {
    render(() => (
      <Field.Root name="root-name">
        <Field.Control data-testid="control" name="control-name" />
      </Field.Root>
    ));

    expect(screen.getByTestId('control')).toHaveAttribute('name', 'root-name');
  });

  it('validates once when changed by the user', () => {
    const validate = vi.fn();

    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('a');
  });

  it('validates once when a controlled value is changed by the user', () => {
    const validate = vi.fn(() => null);

    const [value, setValue] = createSignal('');
    render(() => (
      <Field.Root validationMode="onChange" validate={validate}>
        <Field.Control value={value()} onValueChange={setValue} />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
  });

  it('clears dirty state when a numeric controlled value returns to its initial value', () => {
    const [value, setValue] = createSignal(5);
    render(() => (
      <Field.Root data-testid="root">
        <Field.Control value={value()} onValueChange={(nextValue) => setValue(Number(nextValue))} />
      </Field.Root>
    ));

    const root = screen.getByTestId('root');
    const control = screen.getByRole('textbox');

    expect(root).not.toHaveAttribute('data-dirty');

    fireEvent.input(control, { target: { value: '56' } });
    flush();

    expect(root).toHaveAttribute('data-dirty', '');

    fireEvent.input(control, { target: { value: '5' } });
    flush();

    expect(root).not.toHaveAttribute('data-dirty');
  });

  it('syncs state and validates when the controlled value changes programmatically', () => {
    const validate = vi.fn((_value: unknown) => null);

    const [value, setValue] = createSignal('');
    render(() => (
      <Field.Root data-testid="root" validationMode="onChange" validate={validate}>
        <Field.Control value={value()} onValueChange={setValue} />
      </Field.Root>
    ));

    setValue('external');
    flush();

    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('data-filled', '');
    expect(root).toHaveAttribute('data-dirty', '');
    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.lastCall?.[0]).toBe('external');
  });

  it('applies the defaultValue to the input', () => {
    render(() => (
      <Field.Root>
        <Field.Control defaultValue="hello" />
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).toHaveValue('hello');
  });

  it('calls onValueChange with the input value and event details', () => {
    const onValueChange = vi.fn();

    render(() => (
      <Field.Root>
        <Field.Control onValueChange={onValueChange} />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
    flush();

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe('abc');
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
  });

  it('is labelable by Field.Label via aria-labelledby when the label has an id', () => {
    render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    flush();
    expect(screen.getByTestId('control')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });

  it('commits validation on blur when validationMode="onBlur"', () => {
    const validate = vi.fn(() => 'error');

    render(() => (
      <Field.Root data-testid="root" validationMode="onBlur" validate={validate}>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    const control = screen.getByTestId('control');

    fireEvent.focus(control);
    fireEvent.input(control, { target: { value: 'a' } });
    flush();
    expect(validate).not.toHaveBeenCalled();

    fireEvent.blur(control);
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
  });

  it('commits validation on Enter when not inside a form', () => {
    const validate = vi.fn(() => 'error');

    render(() => (
      <Field.Root data-testid="root" validate={validate}>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    const control = screen.getByTestId('control');

    fireEvent.input(control, { target: { value: 'a' } });
    fireEvent.keyDown(control, { key: 'Enter' });
    flush();

    expect(validate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
  });

  it('marks the control disabled through the Field.Root disabled prop', () => {
    render(() => (
      <Field.Root disabled>
        <Field.Control data-testid="control" />
      </Field.Root>
    ));

    const control = screen.getByTestId('control');
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute('data-disabled', '');
  });

  it('works standalone outside a Field.Root', () => {
    render(() => <Field.Control data-testid="control" />);

    const control = screen.getByTestId('control');
    expect(control.tagName).toBe('INPUT');

    fireEvent.input(control, { target: { value: 'a' } });
    flush();
    expect(control).toHaveValue('a');
  });
});
