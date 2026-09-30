import { createSignal, flush, Show } from 'solid-js';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { Field } from '../index';
import { createRef } from '../../solid-utils/refs';

describe('<Field.Root />', () => {
  it('renders a div', () => {
    render(() => <Field.Root data-testid="field" />);
    expect(screen.getByTestId('field').tagName).toBe('DIV');
  });

  describe('prop: disabled', () => {
    it('adds data-disabled style hook to all components', () => {
      render(() => (
        <Field.Root data-testid="field" disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="message" />
        </Field.Root>
      ));

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const message = screen.getByTestId('message');

      expect(field).toHaveAttribute('data-disabled', '');
      expect(control).toHaveAttribute('data-disabled', '');
      expect(label).toHaveAttribute('data-disabled', '');
      expect(message).toHaveAttribute('data-disabled', '');
      expect(control).toBeDisabled();
    });

    it('keeps an explicitly invalid field marked invalid while disabled', () => {
      render(() => (
        <Field.Root data-testid="field" invalid disabled>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('control')).toHaveAttribute('data-invalid', '');
    });

    it('suppresses computed validity while disabled', () => {
      const { getByTestId } = render(() => (
        <Field.Root data-testid="field" disabled validationMode="onChange" validate={() => 'error'}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(getByTestId('field')).not.toHaveAttribute('data-valid');
      expect(getByTestId('field')).not.toHaveAttribute('data-invalid');
    });
  });

  describe('prop: validate', () => {
    it('does not run by default when not validating on change', () => {
      const validate = vi.fn(() => null);
      render(() => (
        <Field.Root validate={validate}>
          <Field.Control />
        </Field.Root>
      ));

      const control = screen.getByRole('textbox');
      fireEvent.focus(control);
      fireEvent.input(control, { target: { value: 'a' } });
      flush();

      expect(validate).not.toHaveBeenCalled();
    });

    it('runs on change when validationMode="onChange"', () => {
      const validate = vi.fn((value: unknown) => (value === 'bad' ? 'error' : null));
      render(() => (
        <Field.Root data-testid="field" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      const control = screen.getByTestId('control');

      fireEvent.input(control, { target: { value: 'bad' } });
      flush();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('bad');
      expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      expect(control).toHaveAttribute('aria-invalid', 'true');

      fireEvent.input(control, { target: { value: 'good' } });
      flush();

      expect(screen.getByTestId('field')).toHaveAttribute('data-valid', '');
      expect(control).not.toHaveAttribute('aria-invalid');
    });

    ([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['empty array', [] as string[]],
    ] as const).forEach(([label, result]) => {
      it(`treats ${label} result as valid`, () => {
        render(() => (
          <Field.Root data-testid="field" validationMode="onChange" validate={() => result as any}>
            <Field.Control data-testid="control" />
          </Field.Root>
        ));

        fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });
        flush();

        expect(screen.getByTestId('field')).toHaveAttribute('data-valid', '');
      });
    });

    it('supports async validation', async () => {
      const validate = vi.fn(async () => 'async error');
      render(() => (
        <Field.Root data-testid="field" validationMode="onChange" validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });
      flush();

      expect(validate).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(screen.getByTestId('field')).toHaveAttribute('data-invalid', '');
      });
    });

    it('receives the current value as the first argument', () => {
      const validate = vi.fn((_value: unknown) => null);
      render(() => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Field.Control />
        </Field.Root>
      ));

      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'abc' } });
      flush();

      expect(validate.mock.lastCall?.[0]).toBe('abc');
    });
  });

  describe('prop: validationMode', () => {
    describe('onChange', () => {
      it('validates the field on change', () => {
        const validate = vi.fn((value: unknown) => ((value as string).length < 3 ? 'error' : null));

        render(() => (
          <Field.Root data-testid="field" validationMode="onChange" validate={validate}>
            <Field.Control data-testid="control" />
          </Field.Root>
        ));

        const control = screen.getByTestId('control') as HTMLInputElement;

        fireEvent.input(control, { target: { value: 'a' } });
        flush();

        expect(validate).toHaveBeenCalled();
        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });
    });

    describe('onBlur', () => {
      it('validates the field on blur', () => {
        const validate = vi.fn((value: unknown) => ((value as string).length < 3 ? 'error' : null));

        render(() => (
          <Field.Root data-testid="field" validationMode="onBlur" validate={validate}>
            <Field.Control data-testid="control" />
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const control = screen.getByTestId('control') as HTMLInputElement;

        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        flush();
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.blur(control);
        flush();

        expect(control).toHaveAttribute('data-invalid', '');
        expect(screen.queryByTestId('error')).not.toBe(null);
      });

      it('should not mark invalid if `valueMissing` is the only error and not yet dirtied', () => {
        render(() => (
          <Field.Root data-testid="field" validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId('control') as HTMLInputElement;

        fireEvent.focus(control);
        fireEvent.blur(control);
        flush();

        expect(control).not.toHaveAttribute('data-invalid');
      });

      it('should mark invalid if `valueMissing` is the only error and dirtied', () => {
        render(() => (
          <Field.Root data-testid="field" validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId('control') as HTMLInputElement;

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        fireEvent.input(control, { target: { value: '' } });
        fireEvent.blur(control);
        flush();

        expect(control).toHaveAttribute('data-invalid', '');
      });

      it('revalidates on change for `valueMissing`', () => {
        render(() => (
          <Field.Root data-testid="field" validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>
        ));

        const control = screen.getByTestId('control') as HTMLInputElement;

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        fireEvent.input(control, { target: { value: '' } });
        fireEvent.blur(control);
        flush();

        expect(control).toHaveAttribute('data-invalid', '');

        fireEvent.focus(control);
        fireEvent.input(control, { target: { value: 'a' } });
        flush();

        expect(control).not.toHaveAttribute('data-invalid');
      });
    });
  });

  describe('prop: validationDebounceTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces validation', () => {
      const validate = vi.fn((_value: unknown) => 'error');

      render(() => (
        <Field.Root validationMode="onChange" validationDebounceTime={100} validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      const control = screen.getByTestId('control') as HTMLInputElement;

      fireEvent.input(control, { target: { value: 'a' } });
      flush();
      expect(validate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      fireEvent.input(control, { target: { value: 'ab' } });
      flush();
      expect(validate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(99);
      expect(validate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      flush();
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('ab');
    });
  });

  describe('style hooks', () => {
    describe('touched', () => {
      it('applies [data-touched] style hook to all components when touched', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-touched');

        fireEvent.focus(control);
        fireEvent.blur(control);
        flush();

        expect(root).toHaveAttribute('data-touched', '');
        expect(control).toHaveAttribute('data-touched', '');
        expect(label).toHaveAttribute('data-touched', '');
        expect(description).toHaveAttribute('data-touched', '');
      });
    });

    describe('dirty', () => {
      it('applies [data-dirty] style hook to all components when dirty', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        expect(root).not.toHaveAttribute('data-dirty');

        fireEvent.input(control, { target: { value: 'a' } });
        flush();

        expect(root).toHaveAttribute('data-dirty', '');
        expect(control).toHaveAttribute('data-dirty', '');

        fireEvent.input(control, { target: { value: '' } });
        flush();

        expect(root).not.toHaveAttribute('data-dirty');
        expect(control).not.toHaveAttribute('data-dirty');
      });
    });

    describe('filled', () => {
      it('applies [data-filled] style hook to all components when filled', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        expect(root).not.toHaveAttribute('data-filled');

        fireEvent.input(control, { target: { value: 'a' } });
        flush();

        expect(root).toHaveAttribute('data-filled', '');
        expect(control).toHaveAttribute('data-filled', '');

        fireEvent.input(control, { target: { value: '' } });
        flush();

        expect(root).not.toHaveAttribute('data-filled');
      });

      it('is filled initially when the control has a defaultValue', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control defaultValue="hello" />
          </Field.Root>
        ));

        flush();
        expect(screen.getByTestId('root')).toHaveAttribute('data-filled', '');
      });
    });

    describe('focused', () => {
      it('applies [data-focused] style hook to all components when focused', () => {
        render(() => (
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');

        expect(root).not.toHaveAttribute('data-focused');

        fireEvent.focus(control);
        flush();

        expect(root).toHaveAttribute('data-focused', '');
        expect(control).toHaveAttribute('data-focused', '');

        fireEvent.blur(control);
        flush();

        expect(root).not.toHaveAttribute('data-focused');
        expect(control).not.toHaveAttribute('data-focused');
      });
    });
  });

  describe('prop: dirty', () => {
    it('controls the dirty state', () => {
      const [dirty, setDirty] = createSignal(true);
      render(() => (
        <Field.Root data-testid="root" dirty={dirty()}>
          <Field.Control />
        </Field.Root>
      ));

      const root = screen.getByTestId('root');

      expect(root).toHaveAttribute('data-dirty', '');

      setDirty(false);
      flush();

      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('does not update controlled dirty state from user input', () => {
      render(() => (
        <Field.Root data-testid="root" dirty={false}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'a' } });
      flush();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });
  });

  describe('prop: touched', () => {
    it('controls the touched state', () => {
      render(() => (
        <Field.Root data-testid="root" touched>
          <Field.Control />
        </Field.Root>
      ));

      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
    });

    it('does not update controlled touched state on blur', () => {
      render(() => (
        <Field.Root data-testid="root" touched={false}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      const control = screen.getByTestId('control');
      fireEvent.focus(control);
      fireEvent.blur(control);
      flush();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-touched');
    });
  });

  describe('prop: actionsRef', () => {
    it('validates the field when the `validate` method is called', () => {
      const actionsRef = createRef<Field.Root.Actions>();
      const validate = vi.fn(() => 'error');

      render(() => (
        <Field.Root data-testid="root" actionsRef={actionsRef} validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');

      actionsRef.current?.validate();
      flush();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
    });

    it('validates the current control value when the `validate` method is called', () => {
      const actionsRef = createRef<Field.Root.Actions>();
      const validate = vi.fn((_value: unknown) => null);

      render(() => (
        <Field.Root actionsRef={actionsRef} validate={validate}>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      fireEvent.input(screen.getByTestId('control'), { target: { value: 'typed' } });
      flush();

      actionsRef.current?.validate();
      flush();

      expect(validate.mock.lastCall?.[0]).toBe('typed');
    });
  });

  describe('prop: invalid', () => {
    it('marks the field as invalid regardless of computed validity', () => {
      render(() => (
        <Field.Root data-testid="root" invalid>
          <Field.Control data-testid="control" />
        </Field.Root>
      ));

      expect(screen.getByTestId('root')).toHaveAttribute('data-invalid', '');
      expect(screen.getByTestId('control')).toHaveAttribute('data-invalid', '');
    });
  });

  it('updates label association when replacing one control with another', () => {
    const [first, setFirst] = createSignal(true);

    render(() => (
      <Field.Root>
        <Show when={first()} fallback={<Field.Control data-testid="second" />}>
          <Field.Control data-testid="first" />
        </Show>
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    flush();
    expect(label).toHaveAttribute('for', screen.getByTestId('first').id);

    setFirst(false);
    flush();

    expect(label).toHaveAttribute('for', screen.getByTestId('second').id);
  });

  it('updates label associations when the control id changes', () => {
    const [id, setId] = createSignal('one');

    render(() => (
      <Field.Root>
        <Field.Control id={id()} />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    flush();
    expect(label).toHaveAttribute('for', 'one');

    setId('two');
    flush();

    expect(label).toHaveAttribute('for', 'two');
  });
});
