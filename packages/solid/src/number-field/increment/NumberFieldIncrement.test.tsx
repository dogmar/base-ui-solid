import { expect, vi, afterEach } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { NumberField } from '../index';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

describe('<NumberField.Increment />', () => {
  function changeInput(input: Element, value: string) {
    fireEvent.input(input, { target: { value } });
    flush();
  }

  it('has increase label', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Increment />
      </NumberField.Root>
    ));
    expect(screen.queryByLabelText('Increase')).not.toBe(null);
  });

  it('increments starting from 0 click', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    fireEvent.click(button);
    flush();
    expect(screen.getByRole('textbox')).toHaveValue('0');
  });

  it('increments to 1 starting from defaultValue=0 click', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    fireEvent.click(button);
    flush();
    expect(screen.getByRole('textbox')).toHaveValue('1');
  });

  it('seeds an empty fully-negative range in range on first increment', () => {
    render(() => (
      <NumberField.Root min={-10} max={-5}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));
    fireEvent.click(screen.getByRole('button'));
    flush();
    // First step on an empty field seeds the in-range value nearest 0 (the max here), not 0.
    expect(screen.getByRole('textbox')).toHaveValue('-5');
  });

  it('first increment after external controlled update', async () => {
    function Controlled() {
      const [value, setValue] = createSignal<number | null>(null);
      return (
        <NumberField.Root value={value()} onValueChange={setValue}>
          <NumberField.Input />
          <NumberField.Increment />
          <button onClick={() => setValue(1.23456)}>external</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    await userEvent.click(screen.getByText('external'));
    flush();
    expect(input).toHaveValue((1.23456).toLocaleString());

    await userEvent.click(increase);
    flush();
    expect(input).toHaveValue((2.23456).toLocaleString());
  });

  it('increments uncontrolled defaultValue from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    expect(input).toHaveValue((1.23456).toLocaleString());

    await userEvent.click(screen.getByLabelText('Increase'));
    flush();

    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([2.23456]);
    expect(input).toHaveValue((2.23456).toLocaleString());
  });

  it('increments from numeric state after typed precision is formatted on blur', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    await userEvent.click(input);
    await userEvent.keyboard('1.23456');
    flush();
    fireEvent.blur(input);
    flush();

    expect(input).toHaveValue((1.23456).toLocaleString());

    await userEvent.click(increase);
    flush();
    expect(input).toHaveValue((2.23456).toLocaleString());

    await userEvent.click(increase);
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(3.23456);
    expect(input).toHaveValue((3.23456).toLocaleString());
  });

  it('advances by a step finer than 3 fraction digits', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(0);
      return (
        <NumberField.Root
          value={value()}
          step={0.0001}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    // A step smaller than the old 3-digit default used to round back to 0, making this a no-op.
    await userEvent.click(increase);
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
    expect(input).toHaveValue('0');

    await userEvent.click(increase);
    flush();
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0002);
    expect(input).toHaveValue('0');
  });

  it('cleans binary floating point noise introduced by stepping', () => {
    const onValueChange = vi.fn();

    render(() => (
      <NumberField.Root defaultValue={0.7} step={0.1} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>
    ));

    fireEvent.click(screen.getByLabelText('Increase'));
    flush();

    // 0.7 + 0.1 === 0.7999999999999999 in binary floating point.
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.8);
  });

  it('preserves large fractional values when stepping cleanup would be too coarse', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = createSignal<number | null>(100000000000000.1);
      return (
        <NumberField.Root
          value={value()}
          step={0.1}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);

    await userEvent.click(screen.getByLabelText('Increase'));
    flush();

    expect(onValueChange.mock.lastCall?.[0]).toBe(100000000000000.1 + 0.1);
  });

  it('does not commit a stale value when a synced increment is canceled after an external change', () => {
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
          <NumberField.Increment />
          <button onClick={() => setValue(10)}>external</button>
        </NumberField.Root>
      );
    }

    render(() => <Controlled />);
    const increase = screen.getByLabelText('Increase');

    // A prior committed increment populates the internal `lastChangedValueRef` (1).
    fireEvent.click(increase);
    flush();
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

    // The controlled value changes externally to 10.
    fireEvent.click(screen.getByText('external'));
    flush();

    // Canceling the next increment must not commit the stale earlier value (1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    fireEvent.click(increase);
    flush();

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('only calls onValueChange once per increment', async () => {
    const handleValueChange = vi.fn();
    render(() => (
      <NumberField.Root onValueChange={handleValueChange}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');

    await userEvent.click(button);
    flush();
    expect(handleValueChange.mock.calls.length).toBe(1);

    await userEvent.click(button);
    flush();
    expect(handleValueChange.mock.calls.length).toBe(2);
  });

  describe('press and hold', () => {
    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      flush();
    }

    it('increments continuously when holding pointerdown', () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      flush();

      expect(input).toHaveValue('1');

      tick(START_AUTO_CHANGE_DELAY);

      tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.pointerUp(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });

    it('cancels an active mouse press-and-hold interaction when disabled', () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => (
        <NumberField.Root defaultValue={0} disabled={disabled()}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      fireEvent.pointerDown(increment, {
        button: 0,
        pointerType: 'mouse',
      });
      flush();

      expect(input).toHaveValue('1');

      setDisabled(true);
      flush();

      tick(START_AUTO_CHANGE_DELAY);
      tick(CHANGE_VALUE_TICK_DELAY);
      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('1');

      setDisabled(false);
      flush();
      fireEvent.mouseLeave(increment);
      fireEvent.mouseEnter(increment);
      flush();

      expect(input).toHaveValue('1');
    });

    it('cancels the compatibility click from a touch press when disabled', () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => (
        <NumberField.Root defaultValue={0} disabled={disabled()}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      fireEvent.touchStart(increment);
      fireEvent.pointerDown(increment, { pointerType: 'touch' });
      flush();

      setDisabled(true);
      flush();
      setDisabled(false);
      flush();

      fireEvent.pointerUp(increment, { pointerType: 'touch' });
      fireEvent.touchEnd(increment);
      fireEvent.mouseEnter(increment);
      fireEvent.click(increment, { detail: 1 });
      flush();

      expect(input).toHaveValue('0');
    });

    it('removes the global release listener when unmounted during a hold', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const [mounted, setMounted] = createSignal(true);

      try {
        render(() => (
          <Show when={mounted()}>
            <NumberField.Root defaultValue={0}>
              <NumberField.Increment />
              <NumberField.Input />
            </NumberField.Root>
          </Show>
        ));
        fireEvent.pointerDown(screen.getByRole('button'));
        flush();

        const pointerUpListener = addEventListenerSpy.mock.calls.find(
          ([type]) => type === 'pointerup',
        );
        expect(pointerUpListener).toBeDefined();

        setMounted(false);
        flush();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerup', pointerUpListener?.[1], {
          once: true,
        });
      } finally {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
      }
    });

    it('stops calling onValueChange once max is reached', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <NumberField.Root defaultValue={9} max={10} onValueChange={handleValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      flush();

      expect(input).toHaveValue('10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      tick(START_AUTO_CHANGE_DELAY);

      tick(CHANGE_VALUE_TICK_DELAY);
      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      fireEvent.pointerUp(button);
      flush();
    });

    it('commits on release after a hold reaches the boundary', () => {
      const onValueCommitted = vi.fn();
      render(() => (
        <NumberField.Root defaultValue={9} max={10} onValueCommitted={onValueCommitted}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button);
      flush();
      tick(START_AUTO_CHANGE_DELAY);
      tick(CHANGE_VALUE_TICK_DELAY);
      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('10');
      expect(onValueCommitted).not.toHaveBeenCalled();

      fireEvent.pointerUp(button);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('does not commit a stale value when the first hold tick is canceled after dirty input', () => {
      const onValueCommitted = vi.fn();
      let cancelNextChange = false;

      function Controlled() {
        const [value, setValue] = createSignal<number | null>(0);
        return (
          <NumberField.Root
            value={value()}
            onValueChange={(nextValue, details) => {
              if (cancelNextChange) {
                details.cancel();
                cancelNextChange = false;
                return;
              }
              setValue(nextValue);
            }}
            onValueCommitted={onValueCommitted}
          >
            <NumberField.Input />
            <NumberField.Increment />
            <button onClick={() => setValue(10)}>external</button>
          </NumberField.Root>
        );
      }

      render(() => <Controlled />);
      const button = screen.getByLabelText('Increase');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      flush();
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

      fireEvent.click(screen.getByText('external'));
      flush();
      expect(input).toHaveValue('10');

      fireEvent.focus(input);
      changeInput(input, '-');
      expect(input).toHaveValue('-');

      cancelNextChange = true;
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);
      flush();

      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('does not increment twice with pointerdown and click', () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      fireEvent.pointerUp(button);
      fireEvent.click(button, { detail: 1 });
      flush();

      expect(input).toHaveValue('1');
    });

    it('should stop incrementing after mouseleave', () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      flush();

      expect(input).toHaveValue('1');

      tick(START_AUTO_CHANGE_DELAY);

      tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });

    it('should start incrementing again after mouseleave then mouseenter', () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      flush();

      expect(input).toHaveValue('1');

      tick(START_AUTO_CHANGE_DELAY);

      tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseEnter(button);
      flush(); // onChange x5

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('5');
    });

    it('should not start incrementing again after mouseleave then mouseenter after pointerup', () => {
      render(() => (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      flush();

      expect(input).toHaveValue('1');

      tick(START_AUTO_CHANGE_DELAY);

      tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.pointerUp(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseEnter(button);
      flush();

      tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });
  });

  it('should not increment when readOnly', () => {
    render(() => (
      <NumberField.Root readOnly>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    fireEvent.click(button);
    flush();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('should increment when input is dirty but not blurred (click)', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    input.focus();

    changeInput(input, '100');
    fireEvent.click(screen.getByRole('button'));
    flush();

    expect(input).toHaveValue('101');
  });

  it('should increment when input is dirty but not blurred (pointerdown)', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    input.focus();

    changeInput(input, '100');
    fireEvent.pointerDown(screen.getByRole('button'));
    flush();

    expect(input).toHaveValue('101');
  });

  it('ignores non-primary pointer buttons', () => {
    const onValueChange = vi.fn();

    // Controlled and pinned to 0, so the typed text stays out of sync with the stored value and
    // any dirty-text sync from the press would be reported.
    render(() => (
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    input.focus();

    changeInput(input, '100');
    onValueChange.mockClear();

    fireEvent.pointerDown(screen.getByRole('button'), { button: 1 });
    flush();

    // A middle/right press must not even sync the dirty text, let alone start a hold.
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('100');
  });

  it('does not step or commit when the dirty-input sync is canceled', () => {
    const onValueChange = vi.fn((_value, details) => details.cancel());
    const onValueCommitted = vi.fn();

    render(() => (
      <NumberField.Root
        defaultValue={0}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const input = screen.getByRole('textbox');

    input.focus();

    changeInput(input, '100');
    // A keyboard/AT activation reaches `onClick` without a preceding `pointerdown`.
    fireEvent.click(screen.getByRole('button'));
    flush();

    // Both the dirty-text sync and the step that follows it were vetoed: the step still runs
    // (from the unchanged stored 0, not the typed 100), the typed text is left alone, and
    // nothing is committed.
    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([100, 100, 1]);
    expect(input).toHaveValue('100');
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  it('places the caret at the end of the input when a mouse press focuses it', () => {
    render(() => (
      <NumberField.Root defaultValue={100}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });
    flush();

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('treats pen pointer as touch-like', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox');

    fireEvent.pointerDown(button, { pointerType: 'pen', button: 0 });
    flush();

    expect(document.activeElement).not.toBe(input);
  });

  it('always increments on quick touch (touchend that occurs before TOUCH_TIMEOUT)', () => {
    render(() => (
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>
    ));

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox');

    fireEvent.touchStart(button);
    fireEvent.mouseEnter(button);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button, { detail: 1 });
    fireEvent.touchEnd(button);
    flush();

    expect(input).toHaveValue('1');

    fireEvent.touchStart(button);
    // No mouseenter occurs after the first focus
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button, { detail: 1 });
    fireEvent.touchEnd(button);
    flush();

    expect(input).toHaveValue('2');
  });

  describe('prop: snapOnStep', () => {
    it('does not emit a snapped intermediate when committing dirty text before a step', () => {
      const onValueChange = vi.fn();
      render(() => (
        <NumberField.Root defaultValue={0} step={2} snapOnStep onValueChange={onValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      input.focus();

      changeInput(input, '7');
      onValueChange.mockClear();
      fireEvent.click(button);
      flush();

      // The dirty "7" must not be directionally snapped to 6 before the increment runs.
      const values = onValueChange.mock.calls.map((call) => call[0]);
      expect(values).not.toContain(6);
      expect(input).toHaveValue('8');
    });

    it('should increment by exact step without rounding when snapOnStep is false', () => {
      render(() => (
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);
      flush();

      expect(screen.getByRole('textbox')).toHaveValue((4.7).toLocaleString());
    });

    it('should snap on increment when snapOnStep is true', () => {
      render(() => (
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('2');

      changeInput(screen.getByRole('textbox'), '1.9');
      fireEvent.click(button);
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('2');

      changeInput(screen.getByRole('textbox'), '-0.2');
      fireEvent.click(button);
      flush();

      expect(screen.getByRole('textbox')).toHaveValue('0');
    });

    it('seeds an empty field in range without directional snapping', () => {
      render(() => (
        <NumberField.Root min={-10} max={-5} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      fireEvent.click(screen.getByRole('button'));
      flush();
      // The first step seeds the in-range value nearest 0 (the max here). It isn't a step from a
      // previous value, so it must not be directionally snapped (which would land on -6).
      expect(screen.getByRole('textbox')).toHaveValue('-5');
    });

    it('should increment with respect to the min value', () => {
      render(() => (
        <NumberField.Root defaultValue={1} min={1} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      flush();
      expect(input).toHaveValue('3');

      fireEvent.click(button);
      flush();
      expect(input).toHaveValue('5');

      changeInput(input, '1.112');
      fireEvent.click(button);
      flush();
      expect(input).toHaveValue('3');

      changeInput(input, '0.999');
      fireEvent.click(button);
      flush();
      expect(input).toHaveValue('1');
    });
  });

  describe('disabled state', () => {
    it('exposes aria-controls on the stepper', () => {
      render(() => (
        <NumberField.Root readOnly>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', input.id);
    });

    it('should not increment when root is disabled', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <NumberField.Root disabled onValueChange={handleValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);
      flush();
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not increment when button is disabled', () => {
      const handleValueChange = vi.fn();
      render(() => (
        <NumberField.Root defaultValue={0} onValueChange={handleValueChange}>
          <NumberField.Increment disabled />
          <NumberField.Input />
        </NumberField.Root>
      ));
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
      expect(input).toHaveValue('0');

      fireEvent.pointerDown(button);
      flush();
      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('0');
    });

    describe('prop: className', () => {
      it('when root is disabled', () => {
        const classNameSpy = vi.fn();
        render(() => (
          <NumberField.Root disabled>
            <NumberField.Increment className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>
        ));

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });

      it('when button is disabled', () => {
        const classNameSpy = vi.fn();
        render(() => (
          <NumberField.Root>
            <NumberField.Increment disabled className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>
        ));

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });
    });
  });
});
