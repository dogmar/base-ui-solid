import { expect, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { NumberField } from '../index';
import { Field } from '../../field';
import { REASONS } from '../../internals/reasons';

describe('<NumberField.Input />', () => {
  function changeInput(input: Element, value: string) {
    fireEvent.input(input, { target: { value } });
    flush();
  }

  function pasteWithError(target: HTMLElement, error: Error) {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData() {
          throw error;
        },
      },
    });

    fireEvent(target, pasteEvent);
    flush();

    return pasteEvent;
  }

  it('throws a descriptive error when rendered outside <NumberField.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <NumberField.Input />)).toThrow(
        'Base UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('has textbox role', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('textbox')).not.toBe(null);
  });

  it('should not allow non-numeric characters on change', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, 'abc');
    expect(input).toHaveValue('');
  });

  it('should not allow non-numeric characters on keydown', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'a' });
    flush();
    expect(input).toHaveValue('');
  });

  it('should allow numeric characters on change', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '123');
    expect(input).toHaveValue('123');
  });

  it('should increment on keydown ArrowUp', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();
    expect(input).toHaveValue('1');
  });

  it('should decrement on keydown ArrowDown', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    flush();
    expect(input).toHaveValue('-1');
  });

  it('should set the value to min on keydown Home', () => {
    render(() => (
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'Home' });
    flush();
    expect(input).toHaveValue('-10');
  });

  it('should set the value to max on keydown End', () => {
    render(() => (
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'End' });
    flush();
    expect(input).toHaveValue('10');
  });

  it('uses smallStep and snapOnStep when holding Alt with ArrowUp/ArrowDown', () => {
    render(() => (
      <NumberField.Root defaultValue={0.15} smallStep={0.1} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
    flush();
    expect(input).toHaveValue(new Intl.NumberFormat().format(0.3));
    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    flush();
    expect(input).toHaveValue(new Intl.NumberFormat().format(0.2));
  });

  it('advances by a smallStep finer than 3 fraction digits', () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(0);
      return (
        <NumberField.Root
          value={value()}
          smallStep={0.0001}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);

    const input = screen.getByRole('textbox');
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
    expect(input).toHaveValue('0');
  });

  it('increments with keyboard from numeric state, not rounded display text', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();

    // Synced display shows the rounded `1.235`; stepping must advance the full-precision
    // numeric value (matching the button path), not the parsed display string.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('decrements with keyboard from numeric state, not rounded display text', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();

    // ArrowDown must step from the full-precision numeric value (0.23456), not the rounded
    // display (which would yield 0.235).
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.23456);
  });

  it('increments with keyboard from numeric state after a no-edit blur cycle', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await userEvent.keyboard('1.23456');
    flush();
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('steps keyboard from dirty input text when the controlled value lags onValueChange', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    // The parent intentionally never mirrors `onValueChange` back into `value`, so the numeric
    // state stays 0 while the visible text is dirty.
    changeInput(input, '1.5');
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);

    // ArrowUp must step from the dirty text (1.5 -> 2.5), not the stale numeric state (0 -> 1).
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('does not commit a stale value when a synced keyboard step is canceled after an external change', () => {
    const onValueCommitted = vi.fn();
    let cancelNextChange = false;

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(0);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val, details) => {
            if (cancelNextChange) {
              details.cancel();
              return;
            }
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
          <button onClick={() => setValue(10)}>external</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');
    input.focus();

    // A prior committed keyboard step populates the internal `lastChangedValueRef` (1).
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

    // The controlled value changes externally to 10.
    fireEvent.click(screen.getByText('external'));
    flush();

    // Canceling the next keyboard step must not commit the stale earlier value (1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('keeps dirty-input authority after a non-mutating key so the next keyboard step uses dirty text', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    // Dirty text the parent never mirrors back into `value` (still 0).
    changeInput(input, '1.5');

    // A non-mutating navigation key must not mark the input as synced.
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    flush();

    // ArrowUp must still step from the dirty text (1.5 -> 2.5), not the stale numeric state.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('keeps dirty-input authority after a non-mutating key so a button step uses dirty text', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    changeInput(input, '1.5');
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    flush();

    // The button commits the dirty text before stepping, so it must step from 1.5, not 0.
    fireEvent.click(screen.getByLabelText('Increase'));
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('commits dirty text on blur after a cursor key when the controlled value does not mirror it', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    // Parent never mirrors onValueChange, so the numeric state stays 0 while the text is dirty.
    changeInput(input, '5');
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);

    // A cursor key must not clear dirty authority, so blur commits the typed text (5) rather
    // than silently reverting to the stale numeric state (0).
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    onValueChange.mockClear();
    fireEvent.blur(input);
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);
  });

  it('allows unicode plus/minus, permille and fullwidth digits on keydown when formatted as percent', () => {
    render(() => (
      <NumberField.Root format={{ style: 'percent' }}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('−')).toBe(true); // MINUS SIGN U+2212
    expect(dispatchKey('＋')).toBe(true); // FULLWIDTH PLUS SIGN U+FF0B
    expect(dispatchKey('‰')).toBe(true);
    expect(dispatchKey('１')).toBe(true);
  });

  it('blocks percent and permille symbols on keydown when not formatted as percent', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('%')).toBe(false);
    expect(dispatchKey('‰')).toBe(false);
  });

  it('applies locale-aware decimal/group gating (de-DE)', () => {
    render(() => (
      <NumberField.Root locale="de-DE">
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // de-DE: decimal is ',' and group is '.'
    // First comma is allowed
    expect(dispatchKey(',')).toBe(true);
    // Simulate a typical user value with a digit before decimal to let change handler accept it
    changeInput(input, '1,');
    expect(input).toHaveValue('1,');

    // Second comma should be blocked
    expect(dispatchKey(',')).toBe(false);

    // Grouping '.' should be allowed multiple times
    expect(dispatchKey('.')).toBe(true);
    changeInput(input, '1.,');
    expect(dispatchKey('.')).toBe(true);
  });

  it('allows space key when locale uses space-like grouping (pl-PL)', () => {
    render(() => (
      <NumberField.Root locale="pl-PL">
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // pl-PL grouping is a space-like character; typing plain space from keyboard should be
    // allowed
    expect(dispatchKey(' ')).toBe(true);

    // Simulate a typical user value using a regular space as group
    changeInput(input, '1 234');
    expect(input).toHaveValue('1 234');
  });

  it('commits formatted value only on blur', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '1234');
    expect(input).toHaveValue('1234');
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((1234).toLocaleString());
  });

  it('should commit validated number on blur (min)', () => {
    render(() => (
      <NumberField.Root min={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '-1');
    expect(input).toHaveValue('-1');
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue('0');
  });

  it('should commit validated number on blur (max)', () => {
    render(() => (
      <NumberField.Root max={0}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '1');
    expect(input).toHaveValue('1');
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue('0');
  });

  it('should not snap number to step on blur', () => {
    render(() => (
      <NumberField.Root step={0.5} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '1.5');
    expect(input).toHaveValue('1.5');
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((1.5).toLocaleString());
  });

  it('should commit validated number on blur (step and min)', () => {
    render(() => (
      <NumberField.Root min={2} step={2}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');
    input.focus();
    changeInput(input, '3');
    expect(input).toHaveValue('3');
    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue('3');
  });

  it('should preserve default formatting on first blur after external value change', () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.23456);
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    input.blur();
    flush();

    // A focus/blur with no edits must not re-parse the rounded display text and overwrite the
    // numeric value: the display is purely visual formatting.
    expect(input).toHaveValue((1.23456).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should update input value after increment/decrement followed by external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(0);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
          <NumberField.Decrement />
          <button onClick={() => setValue(1.23456)}>external</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');
    const incrementButton = screen.getByLabelText('Increase');

    expect(input).toHaveValue('0');

    await userEvent.click(incrementButton);
    flush();

    expect(input).toHaveValue('1');
    expect(onValueChange.mock.calls.length).toBe(1);

    await userEvent.click(screen.getByText('external'));
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should update input value after decrement followed by external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(5);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
          <NumberField.Decrement />
          <button onClick={() => setValue(2.98765)}>external</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');
    const decrementButton = screen.getByLabelText('Decrease');

    expect(input).toHaveValue('5');

    await userEvent.click(decrementButton);
    flush();

    expect(input).toHaveValue('4');
    expect(onValueChange.mock.calls.length).toBe(1);

    await userEvent.click(screen.getByText('external'));
    flush();

    expect(input).toHaveValue((2.98765).toLocaleString());
  });

  it('should allow typing after default formatting on blur', async () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.23456);
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();
    input.blur();
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();

    await userEvent.clear(input);
    await userEvent.keyboard('1.234567');
    flush();
    expect(input).toHaveValue('1.234567');

    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((1.234567).toLocaleString());
  });

  it('should format to default canonical representation on blur', async () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.23456);
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());

    input.focus();

    await userEvent.clear(input);
    await userEvent.keyboard('1.23456000');
    flush();
    expect(input).toHaveValue('1.23456000');

    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should handle multiple blur cycles with default formatting', () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.23456789);
    flush();

    expect(input).toHaveValue((1.23456789).toLocaleString());

    input.focus();
    input.blur();
    flush();

    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);

    input.focus();
    input.blur();
    flush();

    // Repeated no-edit blur cycles keep the full-precision numeric value; only the display
    // stays formatted to the Intl default.
    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should handle edge case where parsed value equals current value but input differs', async () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox') as HTMLInputElement;

    setValue(1.5);
    flush();

    expect(input).toHaveValue((1.5).toLocaleString());

    input.focus();

    await userEvent.clear(input);
    await userEvent.keyboard('1.50');
    flush();
    expect(input).toHaveValue('1.50');

    fireEvent.blur(input);
    flush();
    expect(input.value).toMatch(/^1[.,]5/);
  });

  it('should apply default formatting after external change during typing', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <button onClick={() => setValue(3.14159265)}>set pi</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();

    await userEvent.keyboard('2.7');
    flush();
    expect(input).toHaveValue('2.7');

    await userEvent.click(screen.getByText('set pi'));
    flush();

    expect(input).toHaveValue((3.14159265).toLocaleString());

    fireEvent.blur(input);
    flush();
    expect(input).toHaveValue((3.14159265).toLocaleString());
  });

  it('should round to explicit maximumFractionDigits on blur', () => {
    const onValueChange = vi.fn();
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root
        value={value()}
        onValueChange={onValueChange}
        format={{ maximumFractionDigits: 2 }}
      >
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.23456);
    flush();

    expect(input).toHaveValue((1.23).toLocaleString());

    input.focus();
    input.blur();
    flush();

    expect(input).toHaveValue((1.23).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1.23);
  });

  function renderControlledNumberField(
    format: Intl.NumberFormatOptions,
    locale: Intl.LocalesArgument = 'en-US',
    rootProps: { min?: number; max?: number; allowOutOfRange?: boolean } = {},
  ) {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            setValue(nextValue);
          }}
          onValueCommitted={onValueCommitted}
          format={format}
          locale={locale}
          {...rootProps}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();

    return { input, onValueChange, onValueCommitted };
  }

  it.each([
    ['en-US', '1.239'],
    ['fr-FR', '1,239'],
    ['ar-EG', '١٫٢٣٩'],
  ] as const)(
    'should respect roundingMode when rounding to explicit maximumFractionDigits on blur in %s',
    async (locale, inputText) => {
      const format = {
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      };

      const { input, onValueChange } = renderControlledNumberField(format, locale);

      await userEvent.keyboard(inputText);
      flush();
      fireEvent.blur(input);
      flush();

      expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
      expect(input).toHaveValue(new Intl.NumberFormat(locale, format).format(1.239));
    },
  );

  it('should not throw on blur when format uses roundingIncrement with fixed fraction digits', () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    render(() => (
      <NumberField.Root defaultValue={1.2} format={format}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    const expectedValue = new Intl.NumberFormat(undefined, format).format(1.2);

    expect(input).toHaveValue(expectedValue);

    input.focus();
    input.blur();
    flush();

    expect(input).toHaveValue(expectedValue);
  });

  it('should commit roundingIncrement values on blur', async () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('1.26');
    flush();
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.5);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.26));
  });

  it('should commit significant digit rounded values on blur', async () => {
    const format = {
      maximumSignificantDigits: 3,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('12345');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(12300);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(12300);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(12345));
  });

  it('should preserve tiny percent significant digit rounded values on blur', async () => {
    const format = {
      style: 'percent',
      maximumSignificantDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('0.0001234%');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0000012);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0000012);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(0.000001234));
  });

  it('should commit roundingMode values on blur without explicit precision', async () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('1.2399');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.239);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.239);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.2399));
  });

  it('should format controlled values with rounding options after external value changes', () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };
    const [value, setValue] = createSignal<number | null>(null);

    render(() => (
      <NumberField.Root value={value()} format={format}>
        <NumberField.Input />
      </NumberField.Root>
    ));
    const input = screen.getByRole('textbox');

    setValue(1.2399);
    flush();

    expect(input).toHaveValue(new Intl.NumberFormat(undefined, format).format(1.2399));
  });

  it.each([
    [
      'percent',
      {
        style: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'percent with min-only precision',
      {
        style: 'percent',
        minimumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'unit percent',
      {
        style: 'unit',
        unit: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      1.23,
    ],
  ] as const)('should round %s values on blur', async (_, format, expectedValue) => {
    const { input, onValueChange } = renderControlledNumberField(format);

    await userEvent.keyboard('1.239%');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(expectedValue);
    expect(input).toHaveValue('1.23%');
  });

  it('should parse locale prefix percent values on blur', () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;
    const formatted = new Intl.NumberFormat('tr-TR', format).format(0.0123);

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(
      format,
      'tr-TR',
    );

    changeInput(input, formatted);
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0123);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0123);
    expect(input).toHaveValue(formatted);
  });

  it('should preserve exact percent precision boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('0.46%');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should preserve high-precision percent boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 16,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(format);

    await userEvent.keyboard('0.46%');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should commit the clamped value when blur rounding crosses a boundary', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted } = renderControlledNumberField(
      format,
      'en-US',
      { max: 0.01235 },
    );

    await userEvent.keyboard('1.236%');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.01235);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.01235);
  });

  it('should round currency values on blur without percent scaling', async () => {
    const format = {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange } = renderControlledNumberField(format);

    await userEvent.keyboard('1.239');
    flush();
    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.239));
  });

  it('should not commit values that overflow while parsing on blur', () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    render(() => (
      <NumberField.Root
        format={format}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    const formattedOverflow = new Intl.NumberFormat(undefined, format).format(Number.MAX_VALUE);

    input.focus();
    changeInput(input, formattedOverflow);
    fireEvent.blur(input);
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue(formattedOverflow);
  });

  it('should not commit a canceled blur change', () => {
    const onValueChange = vi.fn((_nextValue, details) => {
      details.cancel();
    });
    const onValueCommitted = vi.fn();

    render(() => (
      <NumberField.Root
        value={0}
        format={{ maximumFractionDigits: 2 }}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    input.focus();
    changeInput(input, '1.239');
    fireEvent.blur(input);
    flush();

    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue('1.239');
  });

  it('should preserve default numeric precision while formatting display on blur', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();

    await userEvent.keyboard('1.23456');
    flush();
    expect(input).toHaveValue('1.23456');

    // Without explicit rounding options the numeric value keeps full precision rather than
    // being truncated to the Intl display default of 3 fraction digits.
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23456);

    fireEvent.blur(input);
    flush();

    // The committed value retains full precision, while the displayed text uses default
    // formatting.
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.23456);
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should preserve values typed with more than 15 significant digits', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();

    // Parsed input gets no rounding or cleanup beyond standard JS number parsing, so every
    // digit the resulting `number` can represent is preserved (here all 16 typed digits).
    await userEvent.keyboard('1.234567890123456');
    flush();
    expect(input).toHaveValue('1.234567890123456');
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.234567890123456);

    fireEvent.blur(input);
    flush();

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.234567890123456);
    expect(input).toHaveValue((1.234567890123456).toLocaleString());
  });

  it('keeps full numeric precision across no-edit focus/blur cycles and subsequent stepping', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root
          value={value()}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');

    input.focus();
    await userEvent.keyboard('1.23456');
    flush();
    fireEvent.blur(input);
    flush();

    // Display rounds to the Intl default; the committed numeric value keeps full precision.
    expect(input).toHaveValue((1.23456).toLocaleString());
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.23456);

    // Re-focusing and blurring without edits must not re-parse the rounded display text and
    // collapse the stored value, so no new commit fires.
    input.focus();
    input.blur();
    flush();
    expect(onValueCommitted.mock.calls.length).toBe(1);

    // Stepping advances from the full-precision numeric value (2.23456), not the rounded
    // display, which would have yielded 2.235.
    await userEvent.click(screen.getByLabelText('Increase'));
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('commits parsed value on blur and normalizes display for fr-FR', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root locale="fr-FR" onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    changeInput(input, '1234,5');
    expect(input).toHaveValue('1234,5');

    fireEvent.blur(input);
    flush();

    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1234.5);

    expect(input.value).toBe((1234.5).toLocaleString('fr-FR'));
  });

  it('warns in development when clipboard text cannot be read during paste handling', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <NumberField.Root defaultValue={12}>
          <NumberField.Input />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox');
      input.focus();

      const pasteEvent = pasteWithError(input, new DOMException('Blocked', 'SecurityError'));

      expect(input).toHaveValue('12');
      expect(pasteEvent.defaultPrevented).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Base UI: <NumberField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('reports an unchanged value once when a paste event carries no clipboard data', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={12} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    input.focus();

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', { value: null });
    fireEvent(input, pasteEvent);
    flush();

    // Missing clipboard text splices an empty string in, so the text is unchanged. The paste
    // still marks the input dirty, and direct-entry reasons report even when the number is
    // unchanged, so exactly one `input-paste` change is emitted with the current value.
    expect(input).toHaveValue('12');
    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(12);
    expect(onValueChange.mock.calls[0][1].reason).toBe(REASONS.inputPaste);
  });

  describe('single sign character', () => {
    function renderSigned() {
      render(() => (
        <NumberField.Root min={-10} max={10} defaultValue={-5}>
          <NumberField.Input />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.focus();
      expect(input).toHaveValue('-5');

      return {
        input,
        pressMinus() {
          return input.dispatchEvent(
            new window.KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }),
          );
        },
      };
    }

    it('blocks a second minus sign when the existing one is not selected', () => {
      const { input, pressMinus } = renderSigned();
      input.setSelectionRange(2, 2);
      expect(pressMinus()).toBe(false);
    });

    it('allows a minus sign that replaces the selected existing sign', () => {
      const { input, pressMinus } = renderSigned();
      input.setSelectionRange(0, 1);
      expect(pressMinus()).toBe(true);
    });

    it('allows a minus sign when the whole value is selected', () => {
      const { input, pressMinus } = renderSigned();
      input.setSelectionRange(0, input.value.length);
      expect(pressMinus()).toBe(true);
    });
  });

  describe('focus selection', () => {
    it('keeps the selection the browser set when focus moves into the input', () => {
      render(() => (
        <NumberField.Root defaultValue={100}>
          <NumberField.Input />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox') as HTMLInputElement;

      // Tabbing into an input natively selects the whole value before the focus event fires.
      input.setSelectionRange(0, input.value.length);
      input.focus();
      flush();

      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  describe('consumer-prevented defaults', () => {
    it('does not mark the field focused when the focus default is prevented', () => {
      render(() => (
        <Field.Root data-testid="field">
          <NumberField.Root defaultValue={1234}>
            <NumberField.Input onFocus={(event) => event.preventDefault()} />
          </NumberField.Root>
        </Field.Root>
      ));

      // Native focus events are not cancelable, so dispatch a cancelable one to model the
      // consumer-prevented default (React's synthetic events track `preventDefault` regardless).
      fireEvent.focus(screen.getByRole('textbox'), { cancelable: true });
      flush();

      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });

    it('does not reformat, touch, or commit on blur when the blur default is prevented', () => {
      const onValueCommitted = vi.fn();

      render(() => (
        <Field.Root data-testid="field">
          <NumberField.Root onValueCommitted={onValueCommitted}>
            <NumberField.Input onBlur={(event) => event.preventDefault()} />
          </NumberField.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');
      input.focus();
      changeInput(input, '5.10');
      fireEvent.blur(input, { cancelable: true });
      flush();

      expect(input).toHaveValue('5.10');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-touched');
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('ignores a change whose native default was already prevented', () => {
      const onValueChange = vi.fn();

      render(() => (
        <NumberField.Root defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input onInput={(event) => event.preventDefault()} />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox');
      input.focus();
      fireEvent.input(input, { target: { value: '9' }, cancelable: true });
      flush();

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not step when the keydown default is prevented', () => {
      const onValueChange = vi.fn();

      render(() => (
        <NumberField.Root defaultValue={5} onValueChange={onValueChange}>
          <NumberField.Input onKeyDown={(event) => event.preventDefault()} />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox');
      input.focus();
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      flush();

      expect(input).toHaveValue('5');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });
});
