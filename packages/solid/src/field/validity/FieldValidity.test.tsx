import { flush } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { Field, type FieldValidityState } from '../index';

describe('<Field.Validity />', () => {
  it('passes default validity data before any validation', () => {
    let lastState: FieldValidityState | undefined;

    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Validity>
          {(state) => {
            lastState = state;
            return null;
          }}
        </Field.Validity>
      </Field.Root>
    ));

    expect(lastState).toBeDefined();
    expect(lastState?.validity.valid).toBe(null);
    expect(lastState?.errors).toEqual([]);
    expect(lastState?.error).toBe('');
  });

  it('reflects the `invalid` prop in the combined validity', () => {
    let lastState: FieldValidityState | undefined;

    render(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Validity>
          {(state) => {
            lastState = state;
            return null;
          }}
        </Field.Validity>
      </Field.Root>
    ));

    expect(lastState?.validity.valid).toBe(false);
  });

  it('passes updated validity data after a failed validation', () => {
    let lastState: FieldValidityState | undefined;

    render(() => (
      <Field.Root validationMode="onChange" validate={() => 'custom error'}>
        <Field.Control />
        <Field.Validity>
          {(state) => {
            lastState = state;
            return null;
          }}
        </Field.Validity>
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'invalid' } });
    flush();

    expect(lastState?.value).toBe('invalid');
    expect(lastState?.validity.customError).toBe(true);
    expect(lastState?.validity.valid).toBe(false);
    expect(lastState?.error).toBe('custom error');
    expect(lastState?.errors).toEqual(['custom error']);
  });

  it('exposes valueMissing when a dirtied required control is emptied', () => {
    let lastState: FieldValidityState | undefined;

    render(() => (
      <Field.Root validationMode="onBlur">
        <Field.Control required />
        <Field.Validity>
          {(state) => {
            lastState = state;
            return null;
          }}
        </Field.Validity>
      </Field.Root>
    ));

    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: 'a' } });
    fireEvent.input(input, { target: { value: '' } });
    fireEvent.blur(input);
    flush();

    expect(lastState?.validity.valueMissing).toBe(true);
    expect(lastState?.validity.valid).toBe(false);
  });

  it('renders the children output', () => {
    render(() => (
      <Field.Root invalid>
        <Field.Validity>
          {(state) => <span data-testid="output">{String(state.validity.valid)}</span>}
        </Field.Validity>
      </Field.Root>
    ));

    expect(screen.getByTestId('output')).toHaveTextContent('false');
  });
});
