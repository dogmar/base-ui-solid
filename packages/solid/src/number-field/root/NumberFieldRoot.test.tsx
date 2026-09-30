import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { NumberField as NumberFieldBase } from '../index';
import { Field } from '../../field';
import { Form } from '../../form';
import { REASONS } from '../../internals/reasons';

// The Solid test suite runs in jsdom only. Suites the React port restricts to Chromium
// (`describe.skipIf(isJSDOM)`) are intentionally not ported.
describe('<NumberField />', () => {
  function pasteText(target: HTMLElement, value: string) {
    fireEvent.paste(target, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' ? value : ''),
      },
    });
    flush();
  }

  async function settle() {
    flush();
    await Promise.resolve();
    flush();
    await Promise.resolve();
    flush();
  }

  function NumberField(props: NumberFieldBase.Root.Props) {
    return (
      <NumberFieldBase.Root {...props}>
        <NumberFieldBase.Group>
          <NumberFieldBase.Input />
          <NumberFieldBase.Increment />
          <NumberFieldBase.Decrement />
          <NumberFieldBase.ScrubArea />
        </NumberFieldBase.Group>
      </NumberFieldBase.Root>
    );
  }

  function changeInput(input: Element, value: string) {
    fireEvent.input(input, { target: { value } });
    flush();
  }

  describe('prop: defaultValue', () => {
    it('should accept a number value', () => {
      render(() => <NumberField defaultValue={1} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1');
    });

    it('should accept an `undefined` value', () => {
      render(() => <NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('prop: value', () => {
    it('should accept a number value that can change over time', () => {
      const [value, setValue] = createSignal(1);
      render(() => <NumberField value={value()} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1');
      setValue(2);
      flush();
      expect(input).toHaveValue('2');
    });

    it('should accept an `undefined` value', () => {
      render(() => <NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should accept a `null` value', () => {
      render(() => <NumberField value={null} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });

    it('should be `null` when the input is empty but not trimmed', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField value={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');
      changeInput(input, '  ');
      expect(onValueChange.mock.calls[0][0]).toBe(null);
    });
  });

  it('blocks submission when step mismatch occurs', () => {
    render(() => (
      <form data-testid="form">
        <NumberFieldBase.Root name="quantity" min={0} step={0.1}>
          <NumberFieldBase.Group>
            <NumberFieldBase.Input />
          </NumberFieldBase.Group>
        </NumberFieldBase.Root>
        <button type="submit">Submit</button>
      </form>
    ));

    const input = screen.getByRole('textbox');
    changeInput(input, '0.11');

    const hiddenInput = document.querySelector(
      'input[type="number"][name="quantity"]',
    ) as HTMLInputElement;
    expect(hiddenInput).not.toBe(null);
    expect(hiddenInput.validity.stepMismatch).toBe(true);

    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
  });

  it('does not block submission when step="any"', () => {
    render(() => (
      <form data-testid="form">
        <NumberFieldBase.Root name="quantity" min={0} step="any">
          <NumberFieldBase.Group>
            <NumberFieldBase.Input />
          </NumberFieldBase.Group>
        </NumberFieldBase.Root>
        <button type="submit">Submit</button>
      </form>
    ));

    const input = screen.getByRole('textbox');
    changeInput(input, '0.11');

    const hiddenInput = document.querySelector(
      'input[type="number"][name="quantity"]',
    ) as HTMLInputElement;
    expect(hiddenInput).not.toBe(null);
    expect(hiddenInput.validity.stepMismatch).toBe(false);

    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
  });

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(1);
        return (
          <NumberField
            value={value()}
            onValueChange={(val) => {
              onValueChange(val);
              setValue(val);
            }}
          />
        );
      }
      render(() => <App />);
      const input = screen.getByRole('textbox');
      changeInput(input, '2');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(2);
    });

    it('should be called with a number when transitioning from `null`', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(val) => {
              onValueChange(val);
              setValue(val);
            }}
          />
        );
      }
      render(() => <App />);
      const input = screen.getByRole('textbox');
      changeInput(input, '5');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(5);
    });

    it('should be called with `null` when empty and transitioning from a number', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <NumberField
            value={value()}
            onValueChange={(val) => {
              onValueChange(val);
              setValue(val);
            }}
          />
        );
      }
      render(() => <App />);
      const input = screen.getByRole('textbox');
      changeInput(input, '');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(null);
    });

    it('includes the reason for parseable typing', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      changeInput(input, '12');

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputChange);
    });

    it('includes the reason when clearing the value', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={5} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      changeInput(input, '');

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputClear);
    });

    it('includes the reason for keyboard increments', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      input.focus();
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      flush();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('keyboard');
    });

    it('includes the reason for increment button presses', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={1} onValueChange={onValueChange} />);
      const incrementButton = screen.getByRole('button', { name: 'Increase' });

      fireEvent.click(incrementButton);
      flush();

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('increment-press');
    });

    it('includes the reason for decrement button presses', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={1} onValueChange={onValueChange} />);
      const decrementButton = screen.getByRole('button', { name: 'Decrease' });

      fireEvent.click(decrementButton);
      flush();

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('decrement-press');
    });

    it('includes the reason for wheel scrubbing', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField allowWheelScrub defaultValue={4} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      input.focus();
      fireEvent.wheel(input, { deltaY: -100 });
      flush();

      expect(onValueChange.mock.calls.length).toBe(1);
      const [, details] = onValueChange.mock.calls[0] as [
        number | null,
        NumberFieldBase.Root.ChangeEventDetails,
      ];
      expect(details.reason).toBe('wheel');
    });
  });

  describe('typing behavior (parseable changes)', () => {
    it('fires onValueChange for each parseable change while typing', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />
      ));
      const input = screen.getByRole('textbox');

      // Type '1' -> parseable
      changeInput(input, '1');
      // Type '12' -> parseable
      changeInput(input, '12');
      // Type '12.' -> parseable (treated as 12)
      changeInput(input, '12.');
      // Type '12.a' -> not parseable, should not fire
      changeInput(input, '12.a');

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
      expect(onValueChange.mock.calls[2][0]).toBe(12);

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not fire onValueChange for non-numeric composition/partial input', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />
      ));
      const input = screen.getByRole('textbox');

      // Simulate IME composition of non-numeric text; intermediate values like 'ni'
      fireEvent.compositionStart(input);
      changeInput(input, 'n');
      changeInput(input, 'ni');
      fireEvent.compositionEnd(input);
      flush();

      expect(onValueChange.mock.calls.length).toBe(0);

      // Now enter a Han numeral which is parseable
      changeInput(input, '一');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1);

      expect(onValueCommitted.mock.calls.length).toBe(0);
      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1);
    });

    it('handles sign and decimal partials vs. parseable numbers', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} min={-10} />
      ));
      const input = screen.getByRole('textbox');

      // '-' or '.' alone aren't parseable
      changeInput(input, '-');
      changeInput(input, '.');
      // '0.' is parseable (-> 0)
      changeInput(input, '0.');
      changeInput(input, '-1');
      changeInput(input, '-1.5');

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(0);
      expect(onValueChange.mock.calls[1][0]).toBe(-1);
      expect(onValueChange.mock.calls[2][0]).toBe(-1.5);

      // No commit until blur
      expect(onValueCommitted.mock.calls.length).toBe(0);

      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(-1.5);
    });

    it('allows typing a decimal while replacing a selection', () => {
      render(() => <NumberField defaultValue={12.3} locale="en-US" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();

      const decimalIndex = input.value.indexOf('.');
      expect(decimalIndex).toBeGreaterThan(-1);
      input.setSelectionRange(1, decimalIndex + 2);

      const keydownResult = fireEvent.keyDown(input, { key: '.' });
      expect(keydownResult).toBe(true);
    });

    it('accepts grouping while typing and parses progressively', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const groupSeparator =
        new Intl.NumberFormat().formatToParts(10000).find((part) => part.type === 'group')?.value ??
        '';
      expect(groupSeparator).not.toBe('');

      render(() => (
        <NumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />
      ));
      const input = screen.getByRole('textbox');

      changeInput(input, '1'); // 1
      changeInput(input, `1${groupSeparator}`); // 1 (group symbol)
      changeInput(input, `1${groupSeparator}2`); // 12
      changeInput(input, `1${groupSeparator}23`); // 123
      changeInput(input, `1${groupSeparator}234`); // 1234

      expect(onValueChange.mock.calls.length).toBe(5);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(1);
      expect(onValueChange.mock.calls[2][0]).toBe(12);
      expect(onValueChange.mock.calls[3][0]).toBe(123);
      expect(onValueChange.mock.calls[4][0]).toBe(1234);

      expect(onValueCommitted.mock.calls.length).toBe(0);
      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1234);
    });

    it('respects locale decimal separator while typing (de-DE)', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          locale="de-DE"
        />
      ));
      const input = screen.getByRole('textbox');

      changeInput(input, '1'); // 1
      changeInput(input, '1,'); // 1 (decimal separator typed)
      changeInput(input, '1,5'); // 1.5

      expect(onValueChange.mock.calls.length).toBe(3);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(1);
      expect(onValueChange.mock.calls[2][0]).toBe(1.5);

      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(1.5);
    });

    it('parses percent while typing and commits canonical percent value', () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          format={{ style: 'percent' }}
        />
      ));
      const input = screen.getByRole('textbox');

      // Typing digits in percent style represents a fraction (12 -> 0.12)
      changeInput(input, '12');
      // Typing with explicit percent sign also remains 0.12
      changeInput(input, '12%');

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(0.12);
      expect(onValueChange.mock.calls[1][0]).toBe(0.12);
      expect(onValueCommitted.mock.calls.length).toBe(0);

      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0.12);
    });

    it('parses an interleaved percent sign while typing (1%2 -> 12%)', () => {
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={0.01}
          format={{ style: 'percent' }}
          locale="en-US"
          onValueCommitted={onValueCommitted}
        />
      ));

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('1%');

      // Typing `2` after the rendered `1%` yields `1%2`, which must reformat to `12%` on blur.
      fireEvent.focus(input);
      changeInput(input, '1%2');
      fireEvent.blur(input);
      flush();

      expect(input).toHaveValue('12%');
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0.12);
    });

    it('accepts currency symbol while typing and parses numeric value', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' };
      const formatter = new Intl.NumberFormat(undefined, format);
      const parts = formatter.formatToParts(12345);
      const groupSeparator = parts.find((part) => part.type === 'group')?.value ?? '';
      expect(groupSeparator).not.toBe('');

      function formatPartialValue(value: string) {
        let valueInserted = false;
        return parts
          .map((part) => {
            if (
              part.type === 'integer' ||
              part.type === 'group' ||
              part.type === 'decimal' ||
              part.type === 'fraction'
            ) {
              if (!valueInserted) {
                valueInserted = true;
                return value;
              }
              return '';
            }
            return part.value;
          })
          .join('');
      }

      render(() => <NumberField onValueChange={onValueChange} format={format} />);
      const input = screen.getByRole('textbox');

      changeInput(input, formatPartialValue('1'));
      changeInput(input, formatPartialValue(`1${groupSeparator}2`));

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
    });

    it('accepts multi-character currency symbols while typing (e.g. pt-BR BRL)', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { style: 'currency', currency: 'BRL' };
      render(() => (
        <NumberField
          defaultValue={1234.56}
          locale="pt-BR"
          format={format}
          onValueChange={onValueChange}
        />
      ));
      const input = screen.getByRole('textbox');
      const formatted = new Intl.NumberFormat('pt-BR', format).format(1234.56);

      // Type a trailing digit. Previously every keystroke was rejected because the
      // multi-character `R$` symbol failed the per-character validation in the change handler.
      changeInput(input, `${formatted}7`);

      expect(input).toHaveValue(`${formatted}7`);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234.567);
    });

    it('accepts multi-character unit symbols while typing (e.g. km/h)', () => {
      const onValueChange = vi.fn();
      render(() => (
        <NumberField
          locale="en-US"
          format={{ style: 'unit', unit: 'kilometer-per-hour' }}
          onValueChange={onValueChange}
        />
      ));
      const input = screen.getByRole('textbox');

      // The `km/h` unit must not block editing the numeric region.
      changeInput(input, '1 km/h');
      changeInput(input, '12 km/h');

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[0][0]).toBe(1);
      expect(onValueChange.mock.calls[1][0]).toBe(12);
    });

    it('accepts exponent separators while typing (scientific notation)', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { notation: 'scientific' };
      render(() => <NumberField locale="en-US" format={format} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      // `1.5E3` should parse to 1500 rather than being rejected for the `E` separator.
      changeInput(input, '1.5E3');

      expect(input).toHaveValue('1.5E3');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1500);
    });

    it('ignores bidi/format control characters in the value (e.g. RTL exponent signs)', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = { notation: 'scientific' };
      render(() => <NumberField locale="en-US" format={format} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox');

      // RTL locales (e.g. fa-IR) insert a U+200E LEFT-TO-RIGHT MARK around the exponent sign in
      // scientific notation. Inject one into an otherwise-valid value so the test is
      // deterministic across ICU versions: the validator must ignore the control character
      // rather than reject it.
      changeInput(input, '5E‎-1');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(0.5);
    });

    it('allows deleting trailing currency symbols with locale literals', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const formatter = new Intl.NumberFormat('de-DE', format);

      render(() => (
        <NumberField
          defaultValue={12.34}
          locale="de-DE"
          format={format}
          onValueChange={onValueChange}
        />
      ));
      const input = screen.getByRole('textbox');
      const formatted = formatter.format(12.34);
      const withoutCurrency = formatted.replace('€', '');

      changeInput(input, withoutCurrency);

      expect(input).toHaveValue(withoutCurrency);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('allows backspace to remove trailing currency symbol that follows a locale literal', () => {
      const onValueChange = vi.fn();
      const format: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const formatter = new Intl.NumberFormat('de-DE', format);

      render(() => (
        <NumberField
          defaultValue={12.34}
          locale="de-DE"
          format={format}
          onValueChange={onValueChange}
        />
      ));

      const input = screen.getByRole('textbox');
      const formatted = formatter.format(12.34);
      const afterBackspace = formatted.slice(0, -1);

      input.focus();

      const keydownResult = fireEvent.keyDown(input, { key: 'Backspace' });
      expect(keydownResult).toBe(true);

      changeInput(input, afterBackspace);

      expect(input).toHaveValue(afterBackspace);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('does not commit on blur for invalid input', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      changeInput(input, '.');
      expect(input).toHaveValue('.');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });
  });

  describe('prop: onValueCommitted', () => {
    it('fires on blur with committed numeric value', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '123.');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
      // Canonicalizes to 123
      expect(onValueCommitted.mock.calls[0][0]).toBe(123);
    });

    it('fires null on blur when input is cleared', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField defaultValue={5} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(null);
    });

    it('reports and displays the clamped value on blur, not the raw input', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField max={10} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '1000');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(10);
      expect(input).toHaveValue('10');
    });

    it('reports and displays the min-clamped value on blur, not the raw input', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField min={0} onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '-50');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.calls[0][0]).toBe(0);
      expect(input).toHaveValue('0');
    });

    it('fires on keyboard interactions (ArrowUp/Down/Home/End)', () => {
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField defaultValue={0} min={-10} max={10} onValueCommitted={onValueCommitted} />
      ));

      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(0);

      fireEvent.keyDown(input, { key: 'Home' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(3);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(-10);

      fireEvent.keyDown(input, { key: 'End' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(4);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('fires when using increment/decrement buttons', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);

      const input = screen.getByRole('textbox');
      const inc = screen.getByLabelText('Increase');
      const dec = screen.getByLabelText('Decrease');

      fireEvent.click(inc);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);
      expect(input).toHaveValue('1');

      fireEvent.click(dec);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(0);
      expect(input).toHaveValue('0');
    });

    it('includes the correct reason for increment and decrement button presses', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);

      const inc = screen.getByLabelText('Increase');
      const dec = screen.getByLabelText('Decrease');

      fireEvent.click(inc);
      flush();
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.incrementPress);

      fireEvent.click(dec);
      flush();
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.decrementPress);
    });

    it('does not fire when blurring an untouched empty field', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField onValueCommitted={onValueCommitted} />);
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not fire on keyboard steps that do not change the value', () => {
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField defaultValue={5} min={0} max={5} onValueCommitted={onValueCommitted} />
      ));
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'End' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(0);

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(4);
    });

    it('fires once per press-release even after mouseleave/mouseenter during a hold', () => {
      const onValueCommitted = vi.fn();
      render(() => <NumberField defaultValue={0} onValueCommitted={onValueCommitted} />);
      const inc = screen.getByLabelText('Increase');

      fireEvent.pointerDown(inc, { button: 0 });
      fireEvent.mouseLeave(inc);
      fireEvent.mouseEnter(inc, { buttons: 1 });
      fireEvent.pointerUp(inc, { button: 0 });
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
    });

    it('does not commit a canceled keyboard change', () => {
      const onValueChange = vi.fn((_value, details) => details.cancel());
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={0}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />
      ));
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      flush();

      expect(input).toHaveValue('0');
      expect(onValueCommitted.mock.calls.length).toBe(0);
    });

    it('does not commit a canceled clear on blur', () => {
      const onValueChange = vi.fn((_value, details) => details.cancel());
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={5}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />
      ));
      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '');
      fireEvent.blur(input);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(0);
    });
  });

  describe('prop: disabled', () => {
    it('should disable the input', () => {
      render(() => <NumberField disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('disabled');
    });
  });

  describe('prop: readOnly', () => {
    it('should mark the input as readOnly', () => {
      render(() => <NumberField readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('keeps focus state in sync on a readOnly field', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root readOnly>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
        </Field.Root>
      ));
      const input = screen.getByTestId('input');

      fireEvent.focus(input);
      flush();
      expect(input).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      flush();
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('does not render aria-readonly on stepper buttons', () => {
      render(() => <NumberField readOnly />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });
      const decrement = screen.getByRole('button', { name: 'Decrease' });

      // `aria-readonly` isn't valid on the `button` role; the readonly state lives on the input,
      // and the steppers are exposed as unavailable via disabled semantics instead.
      expect(input).toHaveAttribute('readonly');
      expect(increment).not.toHaveAttribute('aria-readonly');
      expect(decrement).not.toHaveAttribute('aria-readonly');
      expect(increment).toHaveAttribute('aria-disabled', 'true');
      expect(decrement).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('prop: required', () => {
    it('should mark the input as required', () => {
      render(() => <NumberField required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('prop: name', () => {
    it('should set the name attribute on the hidden input', () => {
      render(() => <NumberField name="test" />);
      const hiddenInput = document.querySelector('input[aria-hidden][type=number]');
      expect(hiddenInput).toHaveAttribute('name', 'test');
    });

    it('marks the hidden input readOnly when the field is readOnly', () => {
      render(() => <NumberField name="test" readOnly />);
      const hiddenInput = document.querySelector('input[aria-hidden][type=number]');
      expect(hiddenInput).toHaveAttribute('readonly');
    });
  });

  describe('prop: min', () => {
    it('prevents the raw value from going below the `min` prop', () => {
      const fn = vi.fn();

      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              fn(v);
              setValue(v);
            }}
            min={5}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '4');

      expect(input).toHaveValue('4');
      expect(fn.mock.calls[0][0]).toBe(5);
    });

    it('allows the value to go above the `min` prop', () => {
      const fn = vi.fn();

      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              fn(v);
              setValue(v);
            }}
            min={5}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '6');

      expect(input).toHaveValue('6');
    });
  });

  describe('prop: max', () => {
    it('prevents the value from going above the `max` prop', () => {
      const fn = vi.fn();

      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              fn(v);
              setValue(v);
            }}
            max={5}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '6');

      expect(input).toHaveValue('6');
      expect(fn.mock.calls[0][0]).toBe(5);
    });

    it('allows the value to go below the `max` prop', () => {
      const fn = vi.fn();

      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              fn(v);
              setValue(v);
            }}
            max={5}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '4');

      expect(input).toHaveValue('4');
      expect(fn.mock.calls[0][0]).toBe(4);
    });
  });

  describe('prop: allowOutOfRange', () => {
    it('allows typing a negative value via keyboard when min is 0', () => {
      render(() => <NumberField min={0} allowOutOfRange />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.focus();

      // The minus key must not be blocked, so native underflow validation is reachable.
      expect(fireEvent.keyDown(input, { key: '-' })).toBe(true);

      changeInput(input, '-1');
      expect(input).toHaveValue('-1');
    });

    it('allows range overflow validation when true', () => {
      render(() => (
        <form data-testid="form">
          <NumberFieldBase.Root name="quantity" max={5} allowOutOfRange>
            <NumberFieldBase.Group>
              <NumberFieldBase.Input />
            </NumberFieldBase.Group>
          </NumberFieldBase.Root>
          <button type="submit">Submit</button>
        </form>
      ));

      const input = screen.getByRole('textbox');
      changeInput(input, '6');

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('6');
      expect(hiddenInput.validity.rangeOverflow).toBe(true);

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(false);
    });

    it('still clamps step interactions when true', () => {
      render(() => (
        <form data-testid="form">
          <NumberField defaultValue={5} max={5} allowOutOfRange name="quantity" />
          <button type="submit">Submit</button>
        </form>
      ));

      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Increase'));
      flush();

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(input).toHaveValue('5');
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('5');
      expect(hiddenInput.validity.rangeOverflow).toBe(false);

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });

    it('clamps to range when false', () => {
      render(() => (
        <form data-testid="form">
          <NumberFieldBase.Root name="quantity" max={5} allowOutOfRange={false}>
            <NumberFieldBase.Group>
              <NumberFieldBase.Input />
            </NumberFieldBase.Group>
          </NumberFieldBase.Root>
          <button type="submit">Submit</button>
        </form>
      ));

      const input = screen.getByRole('textbox');
      changeInput(input, '6');

      const hiddenInput = document.querySelector(
        'input[type="number"][name="quantity"]',
      ) as HTMLInputElement;

      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput.value).toBe('5');
      expect(hiddenInput.validity.rangeOverflow).toBe(false);

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(form.checkValidity()).toBe(true);
    });
  });

  describe('prop: step', () => {
    it('defaults to 1', () => {
      render(() => <NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Increase'));
      flush();
      expect(input).toHaveValue('6');
    });

    it('should increment the value by the `step` prop', () => {
      render(() => <NumberField defaultValue={4} step={2} />);
      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Increase'));
      flush();
      expect(input).toHaveValue('6');
    });

    it('should snap when incrementing to the nearest multiple of the `step` prop', () => {
      render(() => <NumberField defaultValue={5} step={2} snapOnStep />);
      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Increase'));
      flush();
      expect(input).toHaveValue('6');
    });

    it('should decrement the value by the `step` prop', () => {
      render(() => <NumberField defaultValue={6} step={2} />);
      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Decrease'));
      flush();
      expect(input).toHaveValue('4');
    });

    it('should snap when decrementing to the nearest multiple of the `step` prop', () => {
      render(() => <NumberField defaultValue={5} step={2} snapOnStep />);
      const input = screen.getByRole('textbox');
      fireEvent.click(screen.getByLabelText('Decrease'));
      flush();
      expect(input).toHaveValue('4');
    });
  });

  describe('prop: largeStep', () => {
    it('should increment the value by the default `largeStep` prop of 10 while holding the shift key', () => {
      render(() => <NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      fireEvent.pointerUp(screen.getByLabelText('Increase'), { shiftKey: true });
      flush();
      expect(input).toHaveValue('15');
    });

    it('should decrement the value by the default `largeStep` prop of 10 while holding the shift key', () => {
      render(() => <NumberField defaultValue={6} />);
      const input = screen.getByRole('textbox');
      fireEvent.pointerDown(screen.getByLabelText('Decrease'), { shiftKey: true });
      fireEvent.pointerUp(screen.getByLabelText('Decrease'), { shiftKey: true });
      flush();
      expect(input).toHaveValue('-4');
    });

    it('should use explicit `largeStep` value if provided while holding the shift key', () => {
      render(() => <NumberField defaultValue={5} largeStep={5} />);
      const input = screen.getByRole('textbox');
      fireEvent.pointerDown(screen.getByLabelText('Increase'), { shiftKey: true });
      fireEvent.pointerUp(screen.getByLabelText('Increase'), { shiftKey: true });
      flush();
      expect(input).toHaveValue('10');
    });
  });

  describe('prop: smallStep', () => {
    it('should increment the value by the default `smallStep` prop of 0.1 while holding the alt key', () => {
      render(() => <NumberField defaultValue={5} />);
      const input = screen.getByRole('textbox');
      fireEvent.pointerDown(screen.getByLabelText('Increase'), { altKey: true });
      fireEvent.pointerUp(screen.getByLabelText('Increase'), { altKey: true });
      flush();
      expect(input).toHaveValue((5.1).toLocaleString());
    });

    it('should use explicit `smallStep` value if provided while holding the alt key', () => {
      render(() => <NumberField defaultValue={5} smallStep={0.5} />);
      const input = screen.getByRole('textbox');
      fireEvent.pointerDown(screen.getByLabelText('Increase'), { altKey: true });
      fireEvent.pointerUp(screen.getByLabelText('Increase'), { altKey: true });
      flush();
      expect(input).toHaveValue((5.5).toLocaleString());
    });
  });

  describe('prop: format', () => {
    it('reformats the visible text when the format prop changes at the same value', () => {
      const [format, setFormat] = createSignal<Intl.NumberFormatOptions | undefined>(undefined);
      render(() => <NumberField value={1000} format={format()} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue(new Intl.NumberFormat().format(1000));

      setFormat({ style: 'currency', currency: 'USD' });
      flush();
      expect(input).toHaveValue(
        new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1000),
      );
    });

    it('should format the value using the provided options', () => {
      render(() => (
        <NumberField defaultValue={1000} format={{ style: 'currency', currency: 'USD' }} />
      ));
      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }).format(1000);
      expect(input).toHaveValue(expectedValue);
    });

    it('reflects controlled value changes in the textbox', async () => {
      function App() {
        const [val, setVal] = createSignal<number | null>(1);
        return (
          <div>
            <NumberField value={val()} onValueChange={setVal} />
            <button onClick={() => setVal(1234)}>set</button>
          </div>
        );
      }

      render(() => <App />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveValue('1');

      await userEvent.click(screen.getByText('set'));
      flush();
      expect(input).toHaveValue((1234).toLocaleString());
    });
  });

  describe('prop: allowWheelScrub', () => {
    it('does not scrub on wheel when disabled', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <NumberField defaultValue={5} allowWheelScrub disabled onValueChange={onValueChange} />
      ));
      await settle();
      fireEvent.wheel(screen.getByRole('textbox'), { deltaY: 1 });
      flush();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on wheel when readOnly', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <NumberField defaultValue={5} allowWheelScrub readOnly onValueChange={onValueChange} />
      ));
      await settle();
      fireEvent.wheel(screen.getByRole('textbox'), { deltaY: 1 });
      flush();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('should allow the user to scrub the input value with the mouse wheel', async () => {
      render(() => <NumberField defaultValue={5} allowWheelScrub />);
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();
      fireEvent.wheel(input, { deltaY: 1 });
      flush();
      expect(input).toHaveValue('4');
      fireEvent.wheel(input, { deltaY: -1 });
      flush();
      expect(input).toHaveValue('5');
    });

    it('should not allow the user to scrub the input value with the mouse wheel if `allowWheelScrub` is `false`', async () => {
      render(() => <NumberField defaultValue={5} allowWheelScrub={false} />);
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();
      fireEvent.wheel(input, { deltaY: 1 });
      flush();
      expect(input).toHaveValue('5');
      fireEvent.wheel(input, { deltaY: -5 });
      flush();
      expect(input).toHaveValue('5');
    });

    it('does not scrub on wheel while pinch-zooming (ctrlKey)', async () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={5} allowWheelScrub onValueChange={onValueChange} />);
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.wheel(input, { deltaY: 1, ctrlKey: true });
      flush();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on wheel when the input is not focused', async () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={5} allowWheelScrub onValueChange={onValueChange} />);
      await settle();
      const input = screen.getByRole('textbox');

      fireEvent.wheel(input, { deltaY: 1 });
      flush();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not scrub on a horizontal wheel event, and lets it scroll the page', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />
      ));
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      // `fireEvent` returns false when the event was canceled with `preventDefault`.
      expect(fireEvent.wheel(input, { deltaY: 0, deltaX: 100 })).toBe(true);
      expect(fireEvent.wheel(input, { deltaY: 0, deltaX: -100 })).toBe(true);
      // A precision touchpad emits sub-pixel noise on the cross axis during a sideways swipe.
      expect(fireEvent.wheel(input, { deltaY: -0.5, deltaX: 100 })).toBe(true);
      expect(fireEvent.wheel(input, { deltaY: 0.5, deltaX: -100 })).toBe(true);
      // An event with no movement at all.
      expect(fireEvent.wheel(input, { deltaY: 0, deltaX: 0 })).toBe(true);
      flush();

      expect(input).toHaveValue('5');
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });

    it('scrubs on a vertical wheel event that carries horizontal noise', async () => {
      render(() => <NumberField defaultValue={5} allowWheelScrub />);
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      // `fireEvent` returns false when the event was canceled, which is what stops the page
      // from scrolling out from under the user while the value scrubs.
      expect(fireEvent.wheel(input, { deltaY: 1, deltaX: -0.5 })).toBe(false);
      flush();
      expect(input).toHaveValue('4');

      expect(fireEvent.wheel(input, { deltaY: -1, deltaX: 0.5 })).toBe(false);
      flush();
      expect(input).toHaveValue('5');

      expect(fireEvent.wheel(input, { deltaY: 1 })).toBe(false);
      flush();
      expect(input).toHaveValue('4');
    });

    it('uses largeStep when shift is held and the browser swaps the wheel axis', async () => {
      render(() => <NumberField defaultValue={0} largeStep={10} allowWheelScrub />);
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      // Chromium delivers shift + wheel as a horizontal event, so the horizontal delta carries
      // the intended direction: positive is "down", which steps the value down.
      expect(fireEvent.wheel(input, { deltaY: 0, deltaX: -100, shiftKey: true })).toBe(false);
      flush();
      expect(input).toHaveValue('10');

      expect(fireEvent.wheel(input, { deltaY: 0, deltaX: 100, shiftKey: true })).toBe(false);
      flush();
      expect(input).toHaveValue('0');

      // Cross-axis noise must not flip the direction of the same physical gesture, so the noise
      // here opposes the horizontal delta: the dominant axis has to win.
      expect(fireEvent.wheel(input, { deltaY: 0.5, deltaX: -100, shiftKey: true })).toBe(false);
      flush();
      expect(input).toHaveValue('10');

      expect(fireEvent.wheel(input, { deltaY: -0.5, deltaX: 100, shiftKey: true })).toBe(false);
      flush();
      expect(input).toHaveValue('0');
    });

    it('uses largeStep when shift is held during wheel', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <NumberField
          defaultValue={0}
          largeStep={10}
          allowWheelScrub
          onValueChange={onValueChange}
        />
      ));
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.wheel(input, { deltaY: -1, shiftKey: true });
      flush();
      expect(onValueChange.mock.lastCall?.[0]).toBe(10);
    });

    it('calls onValueChange and onValueCommitted on wheel', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />
      ));
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.wheel(input, { deltaY: 1 });
      flush();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe(4);
      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(4);
      expect(onValueCommitted.mock.lastCall?.[1].reason).toBe(REASONS.wheel);

      fireEvent.wheel(input, { deltaY: -1 });
      flush();
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toBe(5);
      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(5);

      // Blur doesn't commit again; the wheel changes were already committed.
      fireEvent.blur(input);
      flush();
      expect(onValueCommitted.mock.calls.length).toBe(2);
    });

    it('does not commit when a wheel step is a no-op at the boundary', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField
          defaultValue={5}
          max={5}
          allowWheelScrub
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        />
      ));
      await settle();
      const input = screen.getByRole('textbox');
      input.focus();

      fireEvent.wheel(input, { deltaY: -1 });
      flush();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
      expect(input).toHaveValue('5');
    });

    it('syncs the visible input value when using the mouse wheel after pasting', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <NumberField defaultValue={10} allowWheelScrub onValueChange={onValueChange} />
      ));
      await settle();

      const input = screen.getByRole('textbox') as HTMLInputElement;
      input.focus();

      // Select the existing value so the paste replaces it rather than inserting at the caret.
      input.select();
      pasteText(input, '20');

      expect(input).toHaveValue('20');
      expect(onValueChange.mock.lastCall?.[0]).toBe(20);

      fireEvent.wheel(input, { deltaY: -1 });
      flush();

      expect(onValueChange.mock.lastCall?.[0]).toBe(21);
      expect(input).toHaveValue('21');
    });
  });

  describe('Form', () => {
    // FormData-based submission tests are Chromium-only in the React suite and are not ported.

    it('triggers native HTML validation on submit', async () => {
      render(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <NumberField required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await userEvent.click(submit);
      await settle();

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('focuses the input when the field receives an error from Form', async () => {
      function App() {
        const [errors, setErrors] = createSignal<Form.Props['errors']>({});
        return (
          <Form
            errors={errors()}
            onSubmit={(event: Event) => {
              event.preventDefault();
              setErrors({ quantity: 'server error' });
            }}
          >
            <Field.Root name="quantity" data-testid="field">
              <NumberField defaultValue={1} />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      render(() => <App />);
      expect(screen.queryByTestId('error')).toBe(null);
      const submit = screen.getByText('Submit');
      await userEvent.click(submit);
      await settle();

      const input = screen.getByRole('textbox');
      await waitFor(() => expect(input).toHaveFocus());
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('server error');
    });

    it('clears external errors on change', async () => {
      render(() => (
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <NumberField defaultValue={1} />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));
      await settle();

      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      changeInput(input, '5');
      await settle();

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('revalidates immediately after form submission errors using increment button', async () => {
      render(() => (
        <Form>
          <Field.Root name="quantity">
            <NumberField required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit" data-testid="submit">
            Submit
          </button>
        </Form>
      ));

      const submit = screen.getByTestId('submit');
      await userEvent.click(submit);
      await settle();

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      const incrementButton = screen.getByLabelText('Increase');
      await userEvent.click(incrementButton);
      await settle();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('should handle browser autofill', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Field.Root name="quantity">
          <NumberFieldBase.Root onValueChange={onValueChange}>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');
      const hiddenInput = document.querySelector('input[type="number"][name="quantity"]');

      expect(hiddenInput).not.toBe(null);
      fireEvent.input(hiddenInput!, { target: { value: '42' } });
      await settle();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(42);
      expect(input).toHaveValue('42');
    });

    it('validates the parsed number when handling browser autofill', async () => {
      const validate = vi.fn((_value: unknown) => null);

      render(() => (
        <Field.Root name="quantity" validationMode="onChange" validate={validate}>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const hiddenInput = document.querySelector('input[type="number"][name="quantity"]');

      expect(hiddenInput).not.toBe(null);
      fireEvent.input(hiddenInput!, { target: { value: '42' } });
      await settle();

      expect(validate).toHaveBeenCalled();
      expect(validate.mock.calls.every(([value]) => value === 42)).toBe(true);
      expect(validate.mock.lastCall?.[0]).toBe(42);
    });

    it.each([
      { lockState: 'readOnly', label: 'inside Field', withField: true },
      { lockState: 'disabled', label: 'inside Field', withField: true },
      { lockState: 'readOnly', label: 'outside Field', withField: false },
      { lockState: 'disabled', label: 'outside Field', withField: false },
    ] as const)(
      'ignores hidden-input autofill when $lockState $label',
      async ({ lockState, withField }) => {
        const onValueChange = vi.fn();
        const numberField = () => (
          <NumberFieldBase.Root
            name={withField ? undefined : 'quantity'}
            defaultValue={1}
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            onValueChange={onValueChange}
          >
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        );

        render(() => (
          <Show when={withField} fallback={numberField()}>
            <Form errors={{ quantity: 'test' }}>
              <Field.Root name="quantity">
                {numberField()}
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          </Show>
        ));
        await settle();

        const input = screen.getByRole('textbox');
        const hiddenInput = document.querySelector(
          'input[type="number"][name="quantity"]',
        ) as HTMLInputElement;

        expect(hiddenInput).not.toBe(null);

        if (withField) {
          expect(screen.getByTestId('error')).toHaveTextContent('test');
          if (lockState === 'disabled') {
            expect(input).not.toHaveAttribute('aria-invalid');
          } else {
            expect(input).toHaveAttribute('aria-invalid', 'true');
          }
        }

        fireEvent.input(hiddenInput, { target: { value: '42' } });
        await settle();

        expect(onValueChange).not.toHaveBeenCalled();
        expect(input).toHaveValue('1');

        if (withField) {
          expect(screen.getByTestId('error')).toHaveTextContent('test');
        }
      },
    );
  });

  describe('Field', () => {
    it('[data-touched]', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      expect(input).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');

      expect(input).not.toHaveAttribute('data-dirty');

      changeInput(input, '1');

      expect(input).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', () => {
        render(() => (
          <Field.Root>
            <NumberFieldBase.Root>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('data-filled');

        changeInput(input, '1');

        expect(input).toHaveAttribute('data-filled', '');

        changeInput(input, '');

        expect(input).not.toHaveAttribute('data-filled');
      });

      it('has [data-filled] attribute when already filled', () => {
        render(() => (
          <Field.Root>
            <NumberFieldBase.Root defaultValue={1}>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');

        expect(input).toHaveAttribute('data-filled');

        changeInput(input, '');

        expect(input).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);
      flush();

      expect(input).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      flush();

      expect(input).not.toHaveAttribute('data-focused');
    });

    it('adds [data-focused] attribute on every focus', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByTestId('input');

      fireEvent.focus(input);
      flush();
      expect(input).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      flush();
      expect(input).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);
      flush();
      expect(input).toHaveAttribute('data-focused', '');
    });

    it('prop: validate', async () => {
      render(() => (
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');

      expect(input).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(input);
      fireEvent.blur(input);
      await settle();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    describe('prop: validationMode', () => {
      it('onSubmit', async () => {
        render(() => (
          <Form>
            <Field.Root validate={(value) => (value === 1 ? 'custom error' : null)}>
              <NumberFieldBase.Root required data-testid="root">
                <NumberFieldBase.Input data-testid="input" />
              </NumberFieldBase.Root>
              <Field.Error data-testid="error" match="valueMissing">
                valueMissing error
              </Field.Error>
              <Field.Error data-testid="error" match="customError" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));

        const input = screen.getByRole('textbox');
        expect(input).not.toHaveAttribute('aria-invalid');

        changeInput(input, '1');
        fireEvent.blur(input);
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        changeInput(input, '');
        fireEvent.blur(input);
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('valueMissing error');
        expect(screen.getByTestId('root')).toHaveAttribute('data-invalid');
        expect(input).toHaveAttribute('data-invalid');

        changeInput(input, '2');
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(input).not.toHaveAttribute('data-invalid');
        expect(screen.getByTestId('root')).toHaveAttribute('data-valid');
        expect(input).toHaveAttribute('data-valid');
        // re-invalidate the field value
        changeInput(input, '1');
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('custom error');

        changeInput(input, '3');
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        changeInput(input, '');
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).toHaveTextContent('valueMissing error');
      });

      it('onChange', async () => {
        render(() => (
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              return value === 1 ? 'error' : null;
            }}
          >
            <NumberFieldBase.Root>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
          </Field.Root>
        ));

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('aria-invalid');

        changeInput(input, '1');
        await settle();

        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) =>
          (value as number | null) === 5 ? 'error' : null,
        );

        function App() {
          const [value, setValue] = createSignal<number | null>(null);

          return (
            <>
              <Field.Root validationMode="onChange" validate={validateSpy} name="quantity">
                <NumberFieldBase.Root value={value()} onValueChange={(next) => setValue(next)}>
                  <NumberFieldBase.Input data-testid="input" />
                </NumberFieldBase.Root>
              </Field.Root>
              <button type="button" onClick={() => setValue(5)}>
                Set externally
              </button>
            </>
          );
        }

        render(() => <App />);
        await settle();

        const input = screen.getByTestId('input');
        const toggle = screen.getByText('Set externally');

        expect(input).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        fireEvent.click(toggle);
        await settle();

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('onBlur', async () => {
        render(() => (
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              return value === 1 ? 'error' : null;
            }}
          >
            <NumberFieldBase.Root required>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        ));

        const input = screen.getByTestId('input');
        expect(input).not.toHaveAttribute('aria-invalid');

        changeInput(input, '1');
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        fireEvent.blur(input);
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        // revalidation
        changeInput(input, '2');
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

    // jsdom does not show a native validation popup, so this is safe here (the React suite
    // restricts it to jsdom for the same reason).
    it('prevents form submission when the value does not match the step', () => {
      const handleSubmit = vi.fn();
      render(() => (
        <form onSubmit={handleSubmit}>
          <NumberFieldBase.Root name="quantity" defaultValue={0} min={0} step={0.1}>
            <NumberFieldBase.Input data-testid="input" />
          </NumberFieldBase.Root>
          <button type="submit">submit</button>
        </form>
      ));

      const input = screen.getByTestId('input');

      input.focus();

      changeInput(input, '0.11');
      fireEvent.click(screen.getByText('submit'));
      flush();

      expect(handleSubmit.mock.calls.length).toBe(0);

      changeInput(input, '0.1');
      fireEvent.click(screen.getByText('submit'));
      flush();

      expect(handleSubmit.mock.calls.length).toBe(1);
    });

    it('prevents Form/Field submission when the value does not match the step', async () => {
      const handleSubmit = vi.fn();
      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="quantity">
            <NumberFieldBase.Root defaultValue={0} min={0} step={0.1}>
              <NumberFieldBase.Input data-testid="input" />
            </NumberFieldBase.Root>
            <Field.Error match="stepMismatch" data-testid="error">
              step mismatch
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const input = screen.getByTestId('input');

      input.focus();

      expect(screen.queryByTestId('error')).toBe(null);

      changeInput(input, '0.11');
      fireEvent.click(screen.getByText('submit'));
      await settle();

      expect(handleSubmit.mock.calls.length).toBe(0);
      expect(screen.getByTestId('error')).toHaveTextContent('step mismatch');

      changeInput(input, '0.1');
      fireEvent.click(screen.getByText('submit'));
      await settle();

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0].quantity).toBe(0.1);
    });

    it('disables the input when disabled=true', () => {
      render(() => (
        <Field.Root disabled>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('disabled', '');
    });

    it('does not disable the input when disabled=false', () => {
      render(() => (
        <Field.Root disabled={false}>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox');

      expect(input).not.toHaveAttribute('disabled');
    });

    it('is validated with latest value when validationMode=onBlur', async () => {
      const validate = vi.fn(() => 'error');

      render(() => (
        <Form>
          <Field.Root validationMode="onBlur" validate={validate} name="quantity">
            <NumberFieldBase.Root defaultValue={undefined}>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
          </Field.Root>
        </Form>
      ));

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '1');
      fireEvent.blur(input);
      await settle();

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0]).toEqual([1, { quantity: 1 }]);
    });

    it('is validated with clamped value when validationMode=onBlur', async () => {
      const validate = vi.fn(() => null);

      render(() => (
        <Form>
          <Field.Root validationMode="onBlur" validate={validate} name="quantity">
            <NumberFieldBase.Root max={10}>
              <NumberFieldBase.Input />
            </NumberFieldBase.Root>
          </Field.Root>
        </Form>
      ));

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);
      changeInput(input, '1000');
      fireEvent.blur(input);
      await settle();

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0]).toEqual([10, { quantity: 10 }]);
      expect(input).toHaveValue('10');
    });

    it('revalidates an external change after a blur that normalizes back to the current value', async () => {
      const validate = (value: unknown) => (value === 5 ? 'error' : null);

      function App() {
        const [value, setValue] = createSignal<number | null>(5);
        return (
          <Form>
            <Field.Root validationMode="onBlur" validate={validate} name="quantity">
              <NumberFieldBase.Root value={value()} onValueChange={setValue} max={5}>
                <NumberFieldBase.Input />
              </NumberFieldBase.Root>
            </Field.Root>
            <button type="button" onClick={() => setValue(3)}>
              external
            </button>
          </Form>
        );
      }

      render(() => <App />);
      const input = screen.getByRole('textbox');

      // Blur after typing a value that clamps back to the current value (5). This sets the
      // internal block-revalidation flag and commits an error, but since the stored value is
      // unchanged `useValueChanged` won't fire to reset the flag.
      fireEvent.focus(input);
      changeInput(input, '9');
      fireEvent.blur(input);
      await settle();
      expect(input).toHaveValue('5');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      // The flag must have been reset on blur so the next external change revalidates and
      // clears the error rather than being swallowed.
      await userEvent.click(screen.getByText('external'));
      await settle();
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('Field.Label', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input />
          </NumberFieldBase.Root>
          <Field.Label data-testid="label" />
        </Field.Root>
      ));

      expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
    });

    it('Field.Description', () => {
      render(() => (
        <Field.Root>
          <NumberFieldBase.Root>
            <NumberFieldBase.Input aria-describedby="external-description" />
          </NumberFieldBase.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('prop: inputMode', () => {
    it('should set the inputMode to numeric', () => {
      render(() => <NumberField />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('inputmode', 'numeric');
    });
  });

  describe('hidden input', () => {
    function getHiddenInput() {
      const hiddenInput = document.querySelector<HTMLInputElement>(
        'input[aria-hidden][type=number]',
      );
      if (!hiddenInput) {
        throw new Error('Expected a hidden number input.');
      }
      return hiddenInput;
    }

    it('forwards focus to the visible input', () => {
      render(() => <NumberField defaultValue={5} />);

      getHiddenInput().focus();
      flush();

      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('clears the value when autofill empties the hidden input', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={5} onValueChange={onValueChange} />);

      fireEvent.input(getHiddenInput(), { target: { value: '' } });
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(onValueChange.mock.lastCall?.[0]).toBe(null);
    });

    it('applies an autofilled value to the visible input', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField onValueChange={onValueChange} />);

      fireEvent.input(getHiddenInput(), { target: { value: '7' } });
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('7');
      expect(onValueChange.mock.lastCall?.[0]).toBe(7);
    });

    it('validates the autofilled value even when the change is canceled', async () => {
      const validate = vi.fn((_value: unknown) => null);

      render(() => (
        <Field.Root validate={validate} validationMode="onChange">
          <NumberField onValueChange={(_value, details) => details.cancel()} />
        </Field.Root>
      ));

      fireEvent.input(getHiddenInput(), { target: { value: '7' } });
      await settle();

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(validate.mock.lastCall?.[0]).toBe(7);
    });
  });

  describe('integration: exotic inputs and IME', () => {
    it('accepts Persian digit keyboard input', async () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }
      render(() => <App />);
      const input = screen.getByRole('textbox');

      await userEvent.type(input, '۱۲۳');
      flush();

      expect(onValueChange.mock.calls.at(-1)?.[0]).toBe(123);
    });

    it.each([
      ['Persian', '۱۲۳', 123],
      ['Arabic-Indic', '١٢٣', 123],
      ['fullwidth', '１２３', 123],
      ['Han', '一二三', 123],
    ] as const)('pastes %s numerals through the input contract', (_label, text, value) => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={0} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.select();
      pasteText(input, text);

      expect(input).toHaveValue(text);
      expect(onValueChange.mock.lastCall?.[0]).toBe(value);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.inputPaste);
    });

    it('rejects invalid pasted characters without changing the value contract', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={12} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.select();
      pasteText(input, 'abc');

      expect(input).toHaveValue('12');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('parses Persian digits and separators via change events', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }
      render(() => <App />);

      const input = screen.getByRole('textbox');
      // ۱۲٫۳۴ => 12.34
      changeInput(input, '۱۲٫۳۴');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12.34);
    });

    it('parses Persian digits with Arabic group/decimal separators', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }
      render(() => <App />);

      const input = screen.getByRole('textbox');
      // ۱۲٬۳۴۵٫۶۷ => 12345.67
      changeInput(input, '۱۲٬۳۴۵٫۶۷');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12345.67);
    });

    it('parses fullwidth digits and punctuation', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');

      changeInput(input, '１，２３４．５６');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234.56);
    });

    it('parses percent and permille signs in exotic forms when formatted as percent', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            format={{ style: 'percent' }}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '١٢٪');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(0.12);

      // reset by typing again
      changeInput(input, '12؉');
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toBe(0.012);
    });

    it('ignores percent and permille symbols when not formatted as percent', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField onValueChange={onValueChange} />);

      const input = screen.getByRole('textbox');
      changeInput(input, '12');
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(12);

      changeInput(input, '12%');
      changeInput(input, '12‰');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(input).toHaveValue('12');
    });

    it('parses trailing unicode minus', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '1234−');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(-1234);
    });

    it('treats parentheses negatives as invalid input', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '(1,234.5)');

      expect(onValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('');
    });

    it('collapses extra dots from mixed-locale inputs', () => {
      const onValueChange = vi.fn();
      function App() {
        const [value, setValue] = createSignal<number | null>(null);
        return (
          <NumberField
            value={value()}
            onValueChange={(v) => {
              onValueChange(v);
              setValue(v);
            }}
          />
        );
      }

      render(() => <App />);

      const input = screen.getByRole('textbox');
      changeInput(input, '1.234.567.89');

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(1234567.89);
    });

    it('allows composition key events (IME) without preventing default', () => {
      render(() => <NumberField />);

      const input = screen.getByRole('textbox');

      input.focus();

      // 229 indicates a composition key event
      expect(fireEvent.keyDown(input, { which: 229, keyCode: 229 })).toBe(true);
    });
  });

  describe('pasting at the caret', () => {
    it('ignores a paste that does not parse to a number', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={1} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.select();
      pasteText(input, 'abc');

      expect(input).toHaveValue('1');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not paste into a readOnly field', () => {
      render(() => <NumberField defaultValue={1} readOnly />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.select();
      pasteText(input, '9');

      expect(input).toHaveValue('1');
    });

    it('inserts pasted text at the caret instead of replacing the whole value', () => {
      const onValueChange = vi.fn();
      render(() => <NumberField defaultValue={123} onValueChange={onValueChange} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.setSelectionRange(3, 3);
      pasteText(input, '5');

      expect(input).toHaveValue('1235');
      expect(onValueChange.mock.lastCall?.[0]).toBe(1235);
    });

    it('replaces the selected range when pasting over a selection', () => {
      render(() => <NumberField defaultValue={123} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.setSelectionRange(1, 2);
      pasteText(input, '9');

      expect(input).toHaveValue('193');
    });

    it('keeps the caret just after the pasted text', async () => {
      render(() => <NumberField defaultValue={123} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      input.focus();
      input.setSelectionRange(1, 2);
      pasteText(input, '9');
      await settle();

      expect(input).toHaveValue('193');
      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
    });
  });

  it('should allow navigation keys and not prevent their default behavior', () => {
    render(() => <NumberField />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    changeInput(input, '123');

    const navigateKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    navigateKeys.forEach((key) => {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
    });
  });

  it('does not prevent native caret movement for Home/End without min/max', () => {
    render(() => <NumberField defaultValue={5} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    ['Home', 'End'].forEach((key) => {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
    });
  });

  it('does not swallow non-printing keys it does not handle', () => {
    render(() => <NumberField defaultValue={5} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    ['PageUp', 'PageDown', 'Insert', 'F5'].forEach((key) => {
      expect(fireEvent.keyDown(input, { key })).toBe(true);
    });
  });

  describe('prop: locale', () => {
    it('should set the locale of the input', () => {
      render(() => <NumberField defaultValue={1000.5} locale="de-DE" />);
      const input = screen.getByRole('textbox');

      // In German locale, numbers use dot as thousands separator and comma as decimal separator
      const expectedValue = new Intl.NumberFormat('de-DE').format(1000.5);
      expect(input).toHaveValue(expectedValue);
    });

    it('should use the default locale if no locale is provided', () => {
      render(() => <NumberField defaultValue={1000.5} />);
      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat().format(1000.5);
      expect(input).toHaveValue(expectedValue);
    });

    it('should handle locales using space as the thousands separator', () => {
      render(() => <NumberField defaultValue={12345.5} locale="pl" />);

      const input = screen.getByRole('textbox');
      const expectedValue = new Intl.NumberFormat('pl').format(12345.5);
      expect(input).toHaveValue(expectedValue);

      const incrementButton = screen.getByLabelText('Increase');
      fireEvent.click(incrementButton);
      flush();

      const newExpectedValue = new Intl.NumberFormat('pl').format(12346.5);
      expect(input).toHaveValue(newExpectedValue);
    });
  });
});
