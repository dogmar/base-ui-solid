import { expect, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { OTPField } from '../index';
import { Field } from '../../field';
import { REASONS } from '../../internals/reasons';
import type { OTPFieldRootProps } from './OTPFieldRoot';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

const OTP_LENGTH = 6;

type OTPProps = Omit<OTPFieldRootProps, 'children' | 'length'> & { length?: number };

function Otp(props: OTPProps) {
  return (
    <OTPField.Root length={OTP_LENGTH} {...props}>
      {Array.from({ length: props.length ?? OTP_LENGTH }, () => (
        <OTPField.Input />
      ))}
    </OTPField.Root>
  );
}

function getInputs() {
  return screen.getAllByRole('textbox') as HTMLInputElement[];
}

function getValues() {
  return getInputs()
    .map((input) => input.value)
    .join('');
}

function getHiddenInput(name = 'otp') {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
}

function pasteText(target: HTMLElement, value: string) {
  fireEvent.paste(target, {
    clipboardData: {
      getData: () => value,
    },
  });
}

describe('<OTPField.Root />', () => {
  describe('value handling', () => {
    it('splits the default value across inputs', async () => {
      render(() => <Otp defaultValue="12a34b56" />);
      await flushMicrotasks();

      expect(getInputs().map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('clamps an overlong default value to the rendered slot count', async () => {
      render(() => <Otp defaultValue="12a34b56c7" name="otp" />);
      await flushMicrotasks();

      const inputs = getInputs();
      const hiddenInput = getHiddenInput();

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(inputs[0]).toHaveAttribute('maxlength', '6');
      inputs.slice(1).forEach((input) => {
        expect(input).not.toHaveAttribute('maxlength');
      });
      expect(hiddenInput).toHaveValue('123456');
    });

    it('assigns slot indexes from render order when omitted', async () => {
      render(() => (
        <OTPField.Root defaultValue="123" length={3}>
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      ));
      await flushMicrotasks();

      expect(getInputs().map((input) => input.value)).toEqual(['1', '2', '3']);
    });

    it('supports grouped layouts without affecting slot counting', async () => {
      render(() => (
        <OTPField.Root defaultValue="123456" length={6}>
          <div data-testid="first-group">
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </div>
          <OTPField.Separator>-</OTPField.Separator>
          <div data-testid="second-group">
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </div>
        </OTPField.Root>
      ));
      await flushMicrotasks();

      const root = screen.getByRole('group');

      expect(root).toContainElement(screen.getByTestId('first-group'));
      expect(root).toContainElement(screen.getByTestId('second-group'));
      expect(screen.getByText('-')).toBeInTheDocument();
      expect(getInputs().map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('updates the rendered value in controlled mode', async () => {
      const [value, setValue] = createSignal('123456');
      render(() => <Otp value={value()} />);
      await flushMicrotasks();

      expect(getValues()).toBe('123456');

      setValue('654321');
      await flushMicrotasks();

      expect(getValues()).toBe('654321');
    });

    it('keeps the slots unchanged when a controlled owner ignores the change', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp value="" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '1' } });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
      expect(getValues()).toBe('');
      expect(firstInput.value).toBe('');
    });
  });

  describe('prop: validationType', () => {
    it('supports alphabetic values when set to `alpha`', async () => {
      render(() => <Otp defaultValue="1a2b3Cd4" validationType="alpha" />);
      await flushMicrotasks();

      expect(getInputs().map((input) => input.value)).toEqual(['a', 'b', 'C', 'd', '', '']);
    });

    it('supports typing alphabetic values when set to `alpha`', async () => {
      render(() => <Otp validationType="alpha" />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '1a2b3C' } });
      await flushMicrotasks();

      expect(getValues()).toBe('abC');
    });

    it('supports alphanumeric values when set to `alphanumeric`', async () => {
      render(() => <Otp validationType="alphanumeric" />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: 'A1-B2c3' } });
      await flushMicrotasks();

      expect(getValues()).toBe('A1B2c3');
    });

    it('applies single-character validation to each visible slot', async () => {
      render(() => <Otp validationType="alphanumeric" />);
      await flushMicrotasks();

      expect(getInputs()[0]).toHaveAttribute('pattern', '[a-zA-Z0-9]{1}');
    });

    it('renders the hidden validation input with the root pattern', async () => {
      render(() => <Otp name="otp" validationType="alphanumeric" />);
      await flushMicrotasks();

      expect(getHiddenInput()).toHaveAttribute('pattern', '[a-zA-Z0-9]{6}');
    });

    it('omits the hidden validation pattern when set to `none`', async () => {
      render(() => <Otp name="otp" validationType="none" />);
      await flushMicrotasks();

      const hiddenInput = getHiddenInput();

      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput).not.toHaveAttribute('pattern');
    });

    it('allows a custom inputMode when validation is set to `none`', async () => {
      render(() => <Otp name="otp" validationType="none" inputMode="numeric" />);
      await flushMicrotasks();

      expect(getInputs()[0]).toHaveAttribute('inputmode', 'numeric');
      expect(getHiddenInput()).toHaveAttribute('inputmode', 'numeric');
    });

    it('allows overriding the built-in inputMode when needed', async () => {
      render(() => <Otp name="otp" validationType="numeric" inputMode="text" />);
      await flushMicrotasks();

      expect(getInputs()[0]).toHaveAttribute('inputmode', 'text');
      expect(getHiddenInput()).toHaveAttribute('inputmode', 'text');
    });
  });

  describe('prop: normalizeValue', () => {
    it('supports custom normalization when `validationType` is `none`', async () => {
      render(() => (
        <Otp
          validationType="none"
          normalizeValue={(value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
        />
      ));
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: 'ab-12 cd' } });
      await flushMicrotasks();

      expect(getValues()).toBe('AB12CD');
    });

    it('composes with built-in validation and advances focus', async () => {
      render(() => (
        <Otp validationType="alphanumeric" normalizeValue={(value) => value.toUpperCase()} />
      ));
      await flushMicrotasks();

      const inputs = getInputs();
      fireEvent.input(inputs[0], { target: { value: 'a!' } });
      await flushMicrotasks();

      expect(getValues()).toBe('A');
      expect(inputs[1]).toHaveFocus();
    });

    it('composes built-in validation and custom normalization for pasted values', async () => {
      render(() => (
        <Otp validationType="alphanumeric" normalizeValue={(value) => value.toUpperCase()} />
      ));
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, 'ab-12 cd!');
      await flushMicrotasks();

      expect(getValues()).toBe('AB12CD');
    });
  });

  describe('prop: onValueChange', () => {
    it('fires `input-change` when typing', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp onValueChange={onValueChange} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '1' } });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('fires `input-clear` when clearing a slot by input', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp defaultValue="1" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '' } });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputClear);
    });

    it('fires `keyboard` when removing a character with Backspace', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp defaultValue="12" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs[1].focus();
      fireEvent.keyDown(inputs[1], { key: 'Backspace' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
    });

    it('fires `input-paste` when pasting', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp onValueChange={onValueChange} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '123456');
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
    });
  });

  describe('prop: onValueInvalid', () => {
    it('fires when typing is normalized before the OTP value updates', async () => {
      const onValueInvalid = vi.fn();
      render(() => <Otp onValueInvalid={onValueInvalid} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '1a' } });
      await flushMicrotasks();

      expect(getValues()).toBe('1');
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('fires when pasted text is normalized before the OTP value updates', async () => {
      const onValueInvalid = vi.fn();
      render(() => <Otp onValueInvalid={onValueInvalid} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '12x3');
      await flushMicrotasks();

      expect(getValues()).toBe('123');
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12x3');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
    });
  });

  describe('prop: onValueComplete', () => {
    it('fires when typing completes the OTP', async () => {
      const onValueComplete = vi.fn();
      render(() => <Otp defaultValue="12345" onValueComplete={onValueComplete} />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs[5].focus();
      fireEvent.input(inputs[5], { target: { value: '6' } });
      await flushMicrotasks();

      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('fires when pasting completes the OTP', async () => {
      const onValueComplete = vi.fn();
      render(() => <Otp onValueComplete={onValueComplete} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '123456');
      await flushMicrotasks();

      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
    });

    it('fires when a complete paste replaces a complete OTP', async () => {
      const onValueChange = vi.fn();
      const onValueComplete = vi.fn();
      render(() => (
        <Otp
          defaultValue="123456"
          onValueChange={onValueChange}
          onValueComplete={onValueComplete}
        />
      ));
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '123456');
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueComplete).toHaveBeenCalledTimes(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
    });

    it('does not fire when a completion-making paste is canceled', async () => {
      const onValueComplete = vi.fn();
      render(() => (
        <Otp
          onValueChange={(_value, details) => {
            details.cancel();
          }}
          onValueComplete={onValueComplete}
        />
      ));
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '123456');
      await flushMicrotasks();

      expect(getValues()).toBe('');
      expect(onValueComplete).not.toHaveBeenCalled();
    });

    it('does not fire before the OTP becomes complete', async () => {
      const onValueComplete = vi.fn();
      render(() => <Otp onValueComplete={onValueComplete} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      fireEvent.input(firstInput, { target: { value: '12345' } });
      await flushMicrotasks();

      expect(onValueComplete).not.toHaveBeenCalled();
    });
  });

  describe('prop: disabled', () => {
    it('disables every slot and prevents value changes', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp disabled name="otp" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
        expect(input).toHaveAttribute('data-disabled');
      });
      expect(getHiddenInput()).toBeDisabled();

      fireEvent.input(inputs[0], { target: { value: '1' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      // The synthetic input event leaves the raw DOM value behind (real
      // browsers never fire input events on disabled inputs), so assert the
      // component state through the hidden input instead.
      expect(getHiddenInput()).toHaveValue('');
    });
  });

  describe('prop: readOnly', () => {
    it('marks every slot as readonly and prevents value changes', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp readOnly name="otp" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('readonly');
        expect(input).toHaveAttribute('data-readonly');
      });
      expect(getHiddenInput()).toHaveAttribute('readonly');

      fireEvent.input(inputs[0], { target: { value: '1' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(getValues()).toBe('');
    });
  });

  describe('prop: mask', () => {
    it('renders password slot inputs when enabled', async () => {
      render(() => (
        <OTPField.Root length={2} mask data-testid="root">
          <OTPField.Input data-testid="first" />
          <OTPField.Input data-testid="second" />
        </OTPField.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('first')).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('second')).toHaveAttribute('type', 'password');
    });
  });

  describe('accessibility', () => {
    it('forwards root `aria-describedby` to the group', async () => {
      render(() => <Otp aria-describedby="external-description" />);
      await flushMicrotasks();

      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'external-description');
    });

    it('forwards root `aria-labelledby` to the group only', async () => {
      render(() => <Otp aria-labelledby="external-label" />);
      await flushMicrotasks();

      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'external-label');
      getInputs().forEach((input) => {
        expect(input).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('applies the default autocomplete to the first slot only', async () => {
      render(() => <Otp />);
      await flushMicrotasks();

      const inputs = getInputs();
      expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
      inputs.slice(1).forEach((input) => {
        expect(input).toHaveAttribute('autocomplete', 'off');
      });
    });

    it('allows overriding the autocomplete attribute', async () => {
      render(() => <Otp autoComplete="off" name="otp" />);
      await flushMicrotasks();

      expect(getInputs()[0]).toHaveAttribute('autocomplete', 'off');
      expect(getHiddenInput()).toHaveAttribute('autocomplete', 'off');
    });
  });

  describe('Field', () => {
    it('associates Field.Label with the first slot', async () => {
      render(() => (
        <Field.Root>
          <Field.Label data-testid="label">Code</Field.Label>
          <Otp id="otp-id" />
        </Field.Root>
      ));
      await flushMicrotasks();

      const label = screen.getByTestId('label');
      const inputs = getInputs();

      expect(label).toHaveAttribute('for', 'otp-id');
      expect(inputs[0]).toHaveAttribute('id', 'otp-id');
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('aria-labelledby', label.id);
      });
    });

    it('applies the Field description to the group', async () => {
      render(() => (
        <Field.Root>
          <Otp />
          <Field.Description data-testid="description">Enter the code</Field.Description>
        </Field.Root>
      ));
      await flushMicrotasks();

      const description = screen.getByTestId('description');
      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', description.id);
    });

    it('validates the latest value only after focus leaves the OTP field in onBlur mode', async () => {
      const validate = vi.fn();
      render(() => (
        <div>
          <Field.Root validationMode="onBlur" validate={validate}>
            <Otp validationType="none" />
          </Field.Root>
          <button type="button" data-testid="outside">
            outside
          </button>
        </div>
      ));
      await flushMicrotasks();

      const inputs = getInputs();

      inputs[0].focus();
      fireEvent.input(inputs[0], { target: { value: '1' } });
      await flushMicrotasks();

      // Moving between slots does not commit validation.
      fireEvent.blur(inputs[1], { relatedTarget: inputs[2] });
      await flushMicrotasks();
      expect(validate).not.toHaveBeenCalled();

      fireEvent.blur(inputs[1], { relatedTarget: screen.getByTestId('outside') });
      await flushMicrotasks();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('1');
    });

    it('updates filled, focused, dirty and touched state on the root', async () => {
      render(() => (
        <Field.Root>
          <Otp data-testid="root" />
        </Field.Root>
      ));
      await flushMicrotasks();

      const root = screen.getByTestId('root');
      const inputs = getInputs();

      expect(root).not.toHaveAttribute('data-filled');
      expect(root).not.toHaveAttribute('data-focused');
      expect(root).not.toHaveAttribute('data-dirty');
      expect(root).not.toHaveAttribute('data-touched');

      inputs[0].focus();
      await flushMicrotasks();
      expect(root).toHaveAttribute('data-focused');

      fireEvent.input(inputs[0], { target: { value: '1' } });
      await flushMicrotasks();
      expect(root).toHaveAttribute('data-filled');
      expect(root).toHaveAttribute('data-dirty');

      (document.activeElement as HTMLElement | null)?.blur();
      await flushMicrotasks();
      expect(root).not.toHaveAttribute('data-focused');
      expect(root).toHaveAttribute('data-touched');
    });
  });

  it('sets `data-complete` when all slots are filled', async () => {
    render(() => <Otp defaultValue="123456" data-testid="root" />);
    await flushMicrotasks();

    expect(screen.getByTestId('root')).toHaveAttribute('data-complete');
    getInputs().forEach((input) => {
      expect(input).toHaveAttribute('data-complete');
    });
  });

  it('renders a fallback hidden input id when name is not provided', async () => {
    render(() => <Otp id="otp-id" />);
    await flushMicrotasks();

    expect(document.getElementById('otp-id-hidden-input')).toBeInstanceOf(HTMLInputElement);
  });

  describe('Form', () => {
    it('renders the hidden validation input with the provided name and submission value', async () => {
      render(() => (
        <form data-testid="form">
          <Otp name="otp" defaultValue="123456" required />
        </form>
      ));
      await flushMicrotasks();

      const hiddenInput = getHiddenInput();
      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput).toHaveAttribute('minlength', '6');
      expect(hiddenInput).toHaveAttribute('maxlength', '6');
      expect(hiddenInput).toHaveAttribute('pattern', '\\d{6}');
      expect(hiddenInput).toBeRequired();
      expect(hiddenInput).toHaveAttribute('aria-hidden', 'true');
      expect(hiddenInput).toHaveAttribute('tabindex', '-1');

      const formData = new FormData(screen.getByTestId('form') as HTMLFormElement);
      expect(formData.get('otp')).toBe('123456');
    });

    it('redirects hidden validation input focus to the first visible slot', async () => {
      render(() => <Otp name="otp" />);
      await flushMicrotasks();

      getHiddenInput()!.focus();
      await flushMicrotasks();

      expect(getInputs()[0]).toHaveFocus();
    });

    it('handles autofill through the hidden input', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp name="otp" onValueChange={onValueChange} />);
      await flushMicrotasks();

      const hiddenInput = getHiddenInput()!;
      fireEvent.input(hiddenInput, { target: { value: '123456' } });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(getValues()).toBe('123456');
      expect(hiddenInput).toHaveValue('123456');
      expect(getInputs()[5]).toHaveFocus();
    });

    it('rejects invalid characters during hidden input autofill', async () => {
      const onValueInvalid = vi.fn();
      render(() => <Otp name="otp" onValueInvalid={onValueInvalid} />);
      await flushMicrotasks();

      const hiddenInput = getHiddenInput()!;
      fireEvent.input(hiddenInput, { target: { value: '12ab34' } });
      await flushMicrotasks();

      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12ab34');
      expect(getValues()).toBe('1234');
    });

    describe('prop: autoSubmit', () => {
      it('submits the owning form when the OTP becomes complete', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        render(() => (
          <form onSubmit={handleSubmit}>
            <Otp name="otp" defaultValue="12345" autoSubmit />
          </form>
        ));
        await flushMicrotasks();

        const inputs = getInputs();
        inputs[5].focus();
        fireEvent.input(inputs[5], { target: { value: '6' } });
        await flushMicrotasks();

        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not auto-submit the owning form by default', async () => {
        const handleSubmit = vi.fn((event: SubmitEvent) => {
          event.preventDefault();
        });
        render(() => (
          <form onSubmit={handleSubmit}>
            <Otp name="otp" defaultValue="12345" />
          </form>
        ));
        await flushMicrotasks();

        const inputs = getInputs();
        inputs[5].focus();
        fireEvent.input(inputs[5], { target: { value: '6' } });
        await flushMicrotasks();

        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });
  });
});
