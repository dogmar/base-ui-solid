import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { OTPField } from '../index';
import { Field } from '../../field';
import { DirectionProvider } from '../../direction-provider';
import type { OTPFieldRootProps } from '../root/OTPFieldRoot';

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

function pasteText(target: HTMLElement, value: string) {
  fireEvent.paste(target, {
    clipboardData: {
      getData: () => value,
    },
  });
}

describe('<OTPField.Input />', () => {
  it('renders one textbox per slot', async () => {
    render(() => <Otp />);
    await flushMicrotasks();

    expect(getInputs()).toHaveLength(OTP_LENGTH);
  });

  it('moves focus with arrow keys', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    await flushMicrotasks();

    fireEvent.keyDown(inputs[0], { key: 'ArrowRight' });
    await flushMicrotasks();
    expect(inputs[1]).toHaveFocus();

    fireEvent.keyDown(inputs[1], { key: 'ArrowLeft' });
    await flushMicrotasks();
    expect(inputs[0]).toHaveFocus();
  });

  it('moves focus with arrow keys in RTL', async () => {
    render(() => (
      <DirectionProvider direction="rtl">
        <Otp defaultValue="123456" />
      </DirectionProvider>
    ));
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    await flushMicrotasks();

    fireEvent.keyDown(inputs[0], { key: 'ArrowLeft' });
    await flushMicrotasks();
    expect(inputs[1]).toHaveFocus();

    fireEvent.keyDown(inputs[1], { key: 'ArrowRight' });
    await flushMicrotasks();
    expect(inputs[0]).toHaveFocus();
  });

  it('redirects focus to the first empty slot when a later empty slot is focused', async () => {
    render(() => <Otp defaultValue="12" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[4].focus();
    await flushMicrotasks();

    expect(inputs[2]).toHaveFocus();
  });

  it('moves focus to the next slot after typing', async () => {
    render(() => <Otp />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.input(inputs[0], { target: { value: '1' } });
    await flushMicrotasks();

    expect(inputs[0].value).toBe('1');
    expect(inputs[1]).toHaveFocus();
  });

  it('fills consecutive slots when typing multiple characters into the first input', async () => {
    render(() => <Otp />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.input(inputs[0], { target: { value: '123' } });
    await flushMicrotasks();

    expect(getValues()).toBe('123');
    expect(inputs[3]).toHaveFocus();
  });

  it('replaces consecutive slots when typing multiple characters into a later input', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.input(inputs[2], { target: { value: '99' } });
    await flushMicrotasks();

    expect(getValues()).toBe('129956');
    expect(inputs[4]).toHaveFocus();
  });

  it('keeps focus in place when typing is canceled', async () => {
    render(() => (
      <Otp
        onValueChange={(_value, details) => {
          details.cancel();
        }}
      />
    ));
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.input(inputs[0], { target: { value: '1' } });
    await flushMicrotasks();

    expect(getValues()).toBe('');
    expect(inputs[0].value).toBe('');
    expect(inputs[0]).toHaveFocus();
  });

  it('restores the slot value when typing an invalid character into a filled slot', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.input(inputs[0], { target: { value: 'x' } });
    await flushMicrotasks();

    expect(getValues()).toBe('123456');
    expect(inputs[0].value).toBe('1');
  });

  it('moves focus to the next slot when typing the same character into a filled slot', async () => {
    const onValueChange = vi.fn();
    render(() => <Otp defaultValue="123456" onValueChange={onValueChange} />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    await flushMicrotasks();
    inputs[0].setSelectionRange(0, 1);

    fireEvent.keyDown(inputs[0], { key: '1' });
    await flushMicrotasks();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(inputs[1]).toHaveFocus();
  });

  it('moves focus to the first slot with Home', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[4].focus();
    fireEvent.keyDown(inputs[4], { key: 'Home' });
    await flushMicrotasks();

    expect(inputs[0]).toHaveFocus();
  });

  it('moves focus to the empty end slot with End', async () => {
    render(() => <Otp defaultValue="123" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: 'End' });
    await flushMicrotasks();

    expect(inputs[3]).toHaveFocus();
  });

  it('deletes the current character and moves focus to the previous slot on backspace', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 'Backspace' });
    await flushMicrotasks();

    expect(getValues()).toBe('12456');
    expect(inputs[1]).toHaveFocus();
  });

  it('deletes the previous filled slot when backspacing on an empty non-first slot', async () => {
    render(() => <Otp defaultValue="12" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 'Backspace' });
    await flushMicrotasks();

    expect(getValues()).toBe('1');
    expect(inputs[1]).toHaveFocus();
  });

  it('does not fire `onValueChange` for Backspace on an already-empty first slot', async () => {
    const onValueChange = vi.fn();
    render(() => <Otp onValueChange={onValueChange} />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: 'Backspace' });
    await flushMicrotasks();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(inputs[0]).toHaveFocus();
  });

  it('clears the value with a modified Backspace', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[3].focus();
    fireEvent.keyDown(inputs[3], { key: 'Backspace', ctrlKey: true });
    await flushMicrotasks();

    expect(getValues()).toBe('');
    expect(inputs[0]).toHaveFocus();
  });

  it('deletes the current character with Delete without moving focus', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 'Delete' });
    await flushMicrotasks();

    expect(getValues()).toBe('12456');
    expect(inputs[2]).toHaveFocus();
  });

  it('does not fire `onValueChange` for Delete on an empty slot', async () => {
    const onValueChange = vi.fn();
    render(() => <Otp defaultValue="12" onValueChange={onValueChange} />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    fireEvent.keyDown(inputs[2], { key: 'Delete' });
    await flushMicrotasks();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('fills consecutive slots when pasting a code', async () => {
    render(() => <Otp />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    pasteText(inputs[0], '123 456');
    await flushMicrotasks();

    expect(getValues()).toBe('123456');
    expect(inputs[5]).toHaveFocus();
  });

  it('replaces values from the middle when pasting into a later slot', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[2].focus();
    pasteText(inputs[2], '99');
    await flushMicrotasks();

    expect(getValues()).toBe('129956');
    expect(inputs[4]).toHaveFocus();
  });

  it('keeps focus in place when paste is canceled', async () => {
    render(() => (
      <Otp
        onValueChange={(_value, details) => {
          details.cancel();
        }}
      />
    ));
    await flushMicrotasks();

    const inputs = getInputs();
    inputs[0].focus();
    pasteText(inputs[0], '123456');
    await flushMicrotasks();

    expect(getValues()).toBe('');
    expect(inputs[0]).toHaveFocus();
  });

  it('ignores a paste event when clipboard text is unavailable', async () => {
    const onValueChange = vi.fn();
    render(() => <Otp onValueChange={onValueChange} />);
    await flushMicrotasks();

    const [firstInput] = getInputs();
    fireEvent.paste(firstInput, {
      clipboardData: {
        getData: () => '',
      },
    });
    await flushMicrotasks();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(getValues()).toBe('');
  });

  describe('readonly mode', () => {
    it('keeps arrow and home/end navigation working', async () => {
      render(() => <Otp defaultValue="123456" readOnly />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs[0].focus();
      fireEvent.keyDown(inputs[0], { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(inputs[1]).toHaveFocus();

      fireEvent.keyDown(inputs[1], { key: 'End' });
      await flushMicrotasks();
      expect(inputs[5]).toHaveFocus();
    });

    it('blocks Delete and Backspace from changing the value', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp defaultValue="123456" readOnly onValueChange={onValueChange} />);
      await flushMicrotasks();

      const inputs = getInputs();
      inputs[2].focus();
      fireEvent.keyDown(inputs[2], { key: 'Backspace' });
      fireEvent.keyDown(inputs[2], { key: 'Delete' });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(getValues()).toBe('123456');
    });

    it('blocks paste from changing the value', async () => {
      const onValueChange = vi.fn();
      render(() => <Otp readOnly onValueChange={onValueChange} />);
      await flushMicrotasks();

      const [firstInput] = getInputs();
      pasteText(firstInput, '123456');
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(getValues()).toBe('');
    });
  });

  it('assigns roving tabindex based on the active slot', async () => {
    render(() => <Otp defaultValue="12" />);
    await flushMicrotasks();

    const inputs = getInputs();

    // Unfocused: the active slot is the first empty one.
    expect(inputs[2]).toHaveAttribute('tabindex', '0');
    inputs.forEach((input, index) => {
      if (index !== 2) {
        expect(input).toHaveAttribute('tabindex', '-1');
      }
    });

    inputs[0].focus();
    await flushMicrotasks();

    expect(inputs[0]).toHaveAttribute('tabindex', '0');
    expect(inputs[2]).toHaveAttribute('tabindex', '-1');
  });

  it('marks each input as complete when all slots are filled', async () => {
    render(() => <Otp defaultValue="123456" />);
    await flushMicrotasks();

    getInputs().forEach((input) => {
      expect(input).toHaveAttribute('data-complete');
      expect(input).toHaveAttribute('data-filled');
    });
  });

  it('marks only filled slots with `data-filled`', async () => {
    render(() => <Otp defaultValue="12" />);
    await flushMicrotasks();

    const inputs = getInputs();
    expect(inputs[0]).toHaveAttribute('data-filled');
    expect(inputs[1]).toHaveAttribute('data-filled');
    expect(inputs[2]).not.toHaveAttribute('data-filled');
  });

  it('adds disabled and readonly state attributes to each slot', async () => {
    render(() => <Otp disabled readOnly />);
    await flushMicrotasks();

    getInputs().forEach((input) => {
      expect(input).toHaveAttribute('data-disabled');
      expect(input).toHaveAttribute('data-readonly');
    });
  });

  it('applies the Field label to every slot', async () => {
    render(() => (
      <Field.Root>
        <Field.Label data-testid="label">Code</Field.Label>
        <Otp />
      </Field.Root>
    ));
    await flushMicrotasks();

    const label = screen.getByTestId('label');
    getInputs().forEach((input) => {
      expect(input).toHaveAttribute('aria-labelledby', label.id);
    });
  });

  it('ignores `aria-label` on the first slot and applies it to later slots', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <OTPField.Root length={2}>
          <OTPField.Input aria-label="Character 1" />
          <OTPField.Input aria-label="Character 2" />
        </OTPField.Root>
      ));
      await flushMicrotasks();

      const inputs = getInputs();
      expect(inputs[0]).not.toHaveAttribute('aria-label');
      expect(inputs[1]).toHaveAttribute('aria-label', 'Character 2');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <OTPField.Root>', async () => {
    expect(() => render(() => <OTPField.Input />)).toThrow(
      /OTPFieldRootContext is missing\. OTPField parts must be placed within <OTPField\.Root>/,
    );
  });
});
