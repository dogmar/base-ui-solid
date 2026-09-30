import { expect, vi } from 'vitest';
import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Radio } from '../radio';
import { Field } from '../field';
import { Form } from '../form';
import { DirectionProvider, type TextDirection } from '../direction-provider';
import { RadioGroup } from '.';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<RadioGroup />', () => {
  it('renders a `radiogroup`', async () => {
    render(() => <RadioGroup aria-label="My Radio Group" />);
    await flushMicrotasks();

    expect(screen.queryByRole('radiogroup', { name: 'My Radio Group' })).not.toBe(null);
  });

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      const { container } = render(() => <RadioGroup role="switch" />);
      await flushMicrotasks();

      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('prop: id', () => {
    it('is forwarded to the root element', async () => {
      render(() => <RadioGroup id="group-id" />);
      await flushMicrotasks();

      expect(screen.getByRole('radiogroup')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when an item is clicked', async () => {
      const handleChange = vi.fn();
      render(() => (
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('item'));
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe('a');
    });

    it('should report keyboard modifier event properties when calling onValueChange', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn((value, eventDetails) => eventDetails);

      render(() => (
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const item = screen.getByTestId('item');

      await user.keyboard('{Shift>}');
      await user.click(item);
      await user.keyboard('{/Shift}');
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should select an item with Space on keyup', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(() => (
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const item = screen.getByTestId('item');
      item.focus();
      await flushMicrotasks();

      await user.keyboard('[Space>]');
      await flushMicrotasks();

      expect(handleChange).not.toHaveBeenCalled();

      await user.keyboard('[/Space]');
      await flushMicrotasks();

      expect(handleChange).toHaveBeenCalledOnce();
      expect(handleChange).toHaveBeenLastCalledWith('a', expect.anything());
    });

    it('should not select an item with Enter', async () => {
      const handleChange = vi.fn();
      render(() => (
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const item = screen.getByTestId('item');
      item.focus();
      await flushMicrotasks();

      await userEvent.keyboard('[Enter]');
      await flushMicrotasks();

      expect(handleChange).not.toHaveBeenCalled();
      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('does not change state when canceled via a root click', async () => {
      render(() => (
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      await userEvent.click(item);
      await flushMicrotasks();

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      render(() => (
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      expect(input).not.toBe(null);
      if (!input) {
        return;
      }

      await userEvent.click(input);
      await flushMicrotasks();

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via arrow key navigation', async () => {
      render(() => (
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('radiogroup');
      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');

      a.focus();
      await flushMicrotasks();

      fireEvent.keyDown(a, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(b).toHaveFocus();
      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(inputs[0]?.checked).toBe(false);
      expect(inputs[1]?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: value', () => {
    it('controls the checked state', async () => {
      const [value, setValue] = createSignal<string>('a');

      render(() => (
        <RadioGroup value={value()}>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');

      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'false');

      setValue('b');
      await flushMicrotasks();

      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'true');
    });

    it('does not update the uncontrolled state without onValueChange committing', async () => {
      render(() => (
        <RadioGroup value="a">
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('b'));
      await flushMicrotasks();

      expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('b')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('selects the matching radio initially and updates on interaction', async () => {
      render(() => (
        <RadioGroup defaultValue="a">
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');

      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(b).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(b);
      await flushMicrotasks();

      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('should have the `aria-disabled` attribute', async () => {
      render(() => (
        <RadioGroup disabled>
          <Radio.Root value="a" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('data-disabled');
      const input = document.querySelector('input[type="radio"]');
      expect(input).toHaveAttribute('disabled');
    });

    it('should not have the aria attribute when `disabled` is not set', async () => {
      render(() => <RadioGroup />);
      await flushMicrotasks();

      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-disabled');
    });

    it('should not change its state when clicked', async () => {
      render(() => (
        <RadioGroup disabled>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(item);
      await flushMicrotasks();

      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      render(() => <RadioGroup readOnly />);
      await flushMicrotasks();

      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      render(() => <RadioGroup />);
      await flushMicrotasks();

      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      render(() => (
        <RadioGroup readOnly>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(item);
      await flushMicrotasks();

      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    render(() => (
      <RadioGroup data-testid="root">
        <Radio.Root value="" data-testid="item" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    const group = screen.getByTestId('root');
    const item = screen.getByTestId('item');

    const input = group.querySelector<HTMLInputElement>('input')!;

    fireEvent.click(input);
    await flushMicrotasks();

    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('should place the style hooks on the root and subcomponents', async () => {
    render(() => (
      <RadioGroup defaultValue="1" disabled readOnly required>
        <Radio.Root value="1" data-testid="item">
          <Radio.Indicator data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>
    ));
    await flushMicrotasks();

    const root = screen.getByRole('radiogroup');
    const item = screen.getByTestId('item');
    const indicator = screen.getByTestId('indicator');

    expect(root).toHaveAttribute('data-disabled', '');
    expect(root).toHaveAttribute('data-readonly', '');
    expect(root).toHaveAttribute('data-required', '');

    expect(item).toHaveAttribute('data-checked', '');
    expect(item).toHaveAttribute('data-disabled', '');
    expect(item).toHaveAttribute('data-readonly', '');
    expect(item).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');
  });

  it('should set the name attribute on each radio input', async () => {
    render(() => (
      <RadioGroup name="radio-group">
        <Radio.Root value="a" data-testid="radio" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    const radio = screen.getByTestId('radio');
    const input = radio.nextElementSibling as HTMLInputElement;

    expect(input).toHaveAttribute('name', 'radio-group');
    expect(input.value).toBe('a');
  });

  describe('prop: inputRef', () => {
    it('points inputRef to the checked radio input when present', async () => {
      const groupInputRef: { current: HTMLInputElement | null } = { current: null };

      render(() => (
        <RadioGroup defaultValue="a" inputRef={groupInputRef}>
          <Radio.Root value="a" data-testid="radio-a" />
          <Radio.Root value="b" data-testid="radio-b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const radioA = screen.getByTestId('radio-a');
      const radioB = screen.getByTestId('radio-b');
      const inputA = radioA.nextElementSibling as HTMLInputElement;
      const inputB = radioB.nextElementSibling as HTMLInputElement;

      expect(groupInputRef.current).toBe(inputA);

      fireEvent.click(radioB);
      await flushMicrotasks();

      expect(groupInputRef.current).toBe(inputB);
    });

    it('supports inputRef as a function', async () => {
      const inputRefSpy = vi.fn();

      render(() => (
        <RadioGroup defaultValue="a" inputRef={inputRefSpy}>
          <Radio.Root value="a" data-testid="radio-a" />
          <Radio.Root value="b" data-testid="radio-b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const radioA = screen.getByTestId('radio-a');
      const radioB = screen.getByTestId('radio-b');
      const inputA = radioA.nextElementSibling as HTMLInputElement;
      const inputB = radioB.nextElementSibling as HTMLInputElement;

      fireEvent.click(radioB);
      await flushMicrotasks();

      expect(inputRefSpy.mock.calls.some((args) => args[0] === inputA)).toBe(true);
      expect(inputRefSpy.mock.calls.some((args) => args[0] === inputB)).toBe(true);
      expect(inputRefSpy.mock.lastCall?.[0]).toBe(inputB);
    });

    it('skips disabled radios when assigning inputRef', async () => {
      const groupInputRef: { current: HTMLInputElement | null } = { current: null };

      render(() => (
        <RadioGroup inputRef={groupInputRef}>
          <Radio.Root value="a" disabled data-testid="radio-a" />
          <Radio.Root value="b" data-testid="radio-b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const inputB = (screen.getByTestId('radio-b').nextElementSibling ??
        null) as HTMLInputElement | null;

      expect(groupInputRef.current).toBe(inputB);
    });

    it('detaches inputRef when a radio selected after mount unmounts', async () => {
      const groupInputRef: { current: HTMLInputElement | null } = { current: null };
      const [showSecond, setShowSecond] = createSignal(true);

      render(() => (
        <RadioGroup inputRef={groupInputRef}>
          <Radio.Root value="a" data-testid="radio-a" />
          <Show when={showSecond()}>
            <Radio.Root value="b" data-testid="radio-b" />
          </Show>
        </RadioGroup>
      ));
      await flushMicrotasks();

      const inputA = screen.getByTestId('radio-a').nextElementSibling as HTMLInputElement;
      const inputB = screen.getByTestId('radio-b').nextElementSibling as HTMLInputElement;

      expect(groupInputRef.current).toBe(inputA);

      fireEvent.click(screen.getByTestId('radio-b'));
      await flushMicrotasks();

      expect(groupInputRef.current).toBe(inputB);

      setShowSecond(false);
      await flushMicrotasks();

      expect(groupInputRef.current).toBe(null);
    });

    it('detaches inputRef when its current radio unmounts', async () => {
      const groupInputRef: { current: HTMLInputElement | null } = { current: null };
      const [showFirst, setShowFirst] = createSignal(true);

      render(() => (
        <RadioGroup inputRef={groupInputRef}>
          <Show when={showFirst()}>
            <Radio.Root value="a" data-testid="radio-a" />
          </Show>
          <Radio.Root value="b" data-testid="radio-b" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const inputA = screen.getByTestId('radio-a').nextElementSibling as HTMLInputElement;

      expect(groupInputRef.current).toBe(inputA);

      setShowFirst(false);
      await flushMicrotasks();

      expect(groupInputRef.current).toBe(null);
    });
  });

  it('should automatically select radio upon navigation', async () => {
    render(() => (
      <Field.Root>
        <RadioGroup>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </Field.Root>
    ));
    await flushMicrotasks();

    const group = screen.getByRole('radiogroup');
    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');

    a.focus();
    await flushMicrotasks();

    expect(group).not.toHaveAttribute('data-touched');
    expect(a).toHaveAttribute('aria-checked', 'false');

    fireEvent.keyDown(a, { key: 'ArrowDown' });
    await flushMicrotasks();

    expect(a).toHaveAttribute('aria-checked', 'false');

    expect(b).toHaveFocus();
    expect(b).toHaveAttribute('aria-checked', 'true');
    expect(group).toHaveAttribute('data-touched', '');
  });

  describe('should manage arrow key navigation', () => {
    it('ltr', async () => {
      render(() => (
        <DirectionProvider direction={'ltr' as TextDirection}>
          <button data-testid="before" />
          <RadioGroup>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
            <Radio.Root value="c" data-testid="c" />
          </RadioGroup>
          <button data-testid="after" />
        </DirectionProvider>
      ));
      await flushMicrotasks();

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const c = screen.getByTestId('c');

      a.focus();
      await flushMicrotasks();

      expect(a).toHaveFocus();

      fireEvent.keyDown(a, { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(b).toHaveFocus();

      fireEvent.keyDown(b, { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(c).toHaveFocus();

      // loops to the beginning
      fireEvent.keyDown(c, { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(a).toHaveFocus();

      fireEvent.keyDown(a, { key: 'ArrowUp' });
      await flushMicrotasks();
      expect(c).toHaveFocus();

      fireEvent.keyDown(c, { key: 'ArrowUp' });
      await flushMicrotasks();
      expect(b).toHaveFocus();

      fireEvent.keyDown(b, { key: 'ArrowUp' });
      await flushMicrotasks();
      expect(a).toHaveFocus();

      fireEvent.keyDown(a, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expect(c).toHaveFocus();

      fireEvent.keyDown(c, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(a).toHaveFocus();
    });

    it('skips disabled radios', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" disabled data-testid="b" />
          <Radio.Root value="c" data-testid="c" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const a = screen.getByTestId('a');
      const c = screen.getByTestId('c');

      a.focus();
      await flushMicrotasks();

      fireEvent.keyDown(a, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(c).toHaveFocus();

      fireEvent.keyDown(c, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(a).toHaveFocus();
    });

    it('moves focus normally when Shift is pressed', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
          <Radio.Root value="c" data-testid="c" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const c = screen.getByTestId('c');

      a.focus();
      await flushMicrotasks();
      expect(a).toHaveFocus();

      fireEvent.keyDown(a, { key: 'ArrowRight', shiftKey: true });
      await flushMicrotasks();
      expect(b).toHaveFocus();

      fireEvent.keyDown(b, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(c).toHaveFocus();
    });
  });

  it('does not forward `value` prop', async () => {
    render(() => (
      <RadioGroup value="test" data-testid="radio-group">
        <Radio.Root value="" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('radio-group')).not.toHaveAttribute('value');
  });

  it('sets tabIndex=0 to the correct element initially', async () => {
    render(() => (
      <RadioGroup defaultValue="b">
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');

    expect(radioA).not.toHaveAttribute('tabindex', '0');
    expect(radioB).toHaveAttribute('tabindex', '0');
  });

  describe('with native <label>', () => {
    it('associates explicitly', async () => {
      const changeSpy = vi.fn((newValue) => newValue);
      render(() => (
        <RadioGroup onValueChange={changeSpy}>
          <div>
            <label data-testid="label" for="RadioA">
              Apple
            </label>
            <Radio.Root value="apple" id="RadioA" />
          </div>

          <div>
            <label data-testid="label" for="RadioB">
              Banana
            </label>
            <Radio.Root value="banana" id="RadioB" />
          </div>
        </RadioGroup>
      ));
      await flushMicrotasks();

      const [label1, label2] = screen.getAllByTestId('label');

      fireEvent.click(label1);
      await flushMicrotasks();
      expect(changeSpy.mock.calls.length).toBe(1);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');

      fireEvent.click(label2);
      await flushMicrotasks();
      expect(changeSpy.mock.calls.length).toBe(2);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
    });
  });

  describe('Field', () => {
    it('passes the `name` prop to the radio input', async () => {
      render(() => (
        <Field.Root name="test" data-testid="field">
          <RadioGroup name="group">
            <Field.Item>
              <Radio.Root value="a" data-testid="item" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const radio = screen.getByTestId('item');
      const input = radio.nextElementSibling as HTMLInputElement;

      expect(input).toHaveAttribute('name', 'test');
    });

    it('should receive disabled prop from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <RadioGroup>
            <Field.Item>
              <Radio.Root value="a" data-testid="radio" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const radioGroup = screen.getByRole('radiogroup');
      const radio = screen.getByTestId('radio');

      expect(radioGroup).toHaveAttribute('aria-disabled', 'true');
      expect(radioGroup).toHaveAttribute('data-disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
      expect(radio).toHaveAttribute('data-disabled');
    });

    it('sets data-dirty and data-filled after selection', async () => {
      render(() => (
        <Field.Root>
          <RadioGroup>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('radiogroup');

      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');

      fireEvent.click(screen.getByTestId('item'));
      await flushMicrotasks();

      expect(group).toHaveAttribute('data-dirty', '');
      expect(group).toHaveAttribute('data-filled', '');
      expect(group).toHaveAttribute('data-touched', '');
    });

    it('revalidates when the controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as string) === 'b' ? 'error' : null));
      const [value, setValue] = createSignal('a');

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="choices">
          <RadioGroup value={value()} onValueChange={(nextValue) => setValue(nextValue as string)}>
            <Field.Item>
              <Radio.Root value="a" data-testid="radio" />
            </Field.Item>
            <Field.Item>
              <Radio.Root value="b" data-testid="radio" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>
      ));
      await flushMicrotasks();

      const radioGroup = screen.getByRole('radiogroup');

      expect(radioGroup).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      setValue('b');
      await flushMicrotasks();
      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe('b');
      expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
    });

    describe('prop: validationMode', () => {
      it('onBlur validates only when focus leaves the group', async () => {
        const validate = vi.fn((value) => (value === 'a' ? 'error' : null));

        render(() => (
          <>
            <Field.Root validationMode="onBlur" validate={validate}>
              <RadioGroup defaultValue="a">
                <Radio.Root value="a" data-testid="radio-a" />
                <Radio.Root value="b" data-testid="radio-b" />
              </RadioGroup>
            </Field.Root>
            <button type="button">Outside</button>
          </>
        ));
        await flushMicrotasks();

        const group = screen.getByRole('radiogroup');
        const radioA = screen.getByTestId('radio-a');
        const radioB = screen.getByTestId('radio-b');

        fireEvent.focusIn(radioA);
        fireEvent.focusOut(group, { relatedTarget: radioB });
        await flushMicrotasks();

        expect(validate).not.toHaveBeenCalled();

        fireEvent.focusOut(group, { relatedTarget: screen.getByText('Outside') });
        await flushMicrotasks();
        await flushMicrotasks();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.calls[0][0]).toBe('a');
        expect(group).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });

  describe('Form', () => {
    it('triggers native HTML validation on submit', async () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required>
              <Field.Item>
                <Radio.Root value="a" data-testid="item" />
              </Field.Item>
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();
      await flushMicrotasks();

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('submits null to onFormSubmit when no radio is selected', async () => {
      const handleSubmit = vi.fn();

      render(() => (
        <Form data-testid="form" onFormSubmit={handleSubmit}>
          <Field.Root name="test">
            <RadioGroup name="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('submits the selected value to onFormSubmit', async () => {
      const handleSubmit = vi.fn();

      render(() => (
        <Form data-testid="form" onFormSubmit={handleSubmit}>
          <Field.Root name="test">
            <RadioGroup name="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('item-b'));
      await flushMicrotasks();

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: 'b' });
    });

    it('excludes an initially disabled selected radio from onFormSubmit to match native form data', async () => {
      const handleSubmit = vi.fn();

      render(() => (
        <Form data-testid="form" onFormSubmit={handleSubmit}>
          <Field.Root name="test">
            <RadioGroup name="group" defaultValue="a">
              <Radio.Root value="a" disabled data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('clears required validation when a value is selected', async () => {
      render(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required data-testid="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);

      const group = screen.getByTestId('group');
      const radioA = screen.getByTestId('item-a');
      const radioB = screen.getByTestId('item-b');

      fireEvent.click(screen.getByText('Submit'));
      await flushMicrotasks();
      await flushMicrotasks();

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(radioA).toHaveAttribute('aria-invalid', 'true');
      expect(radioB).toHaveAttribute('aria-invalid', 'true');

      fireEvent.click(radioB);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(group).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioA).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioB).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('unblocks submission after every radio in the group unmounts', async () => {
      const handleSubmit = vi.fn();
      const [mounted, setMounted] = createSignal(true);

      render(() => (
        <Form data-testid="form" onFormSubmit={handleSubmit}>
          <Field.Root name="choice">
            <RadioGroup required>
              <Show when={mounted()}>
                <Radio.Root value="a" />
              </Show>
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      await flushMicrotasks();

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();
      expect(handleSubmit).not.toHaveBeenCalled();

      setMounted(false);
      await flushMicrotasks();

      fireEvent.submit(screen.getByTestId('form'));
      await flushMicrotasks();

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ choice: null });
    });
  });
});
