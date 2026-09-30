import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Switch } from '../index';
import { Field } from '../../field';
import { Form } from '../../form';
import { createRef } from '../../solid-utils/refs';

describe('<Switch.Root />', () => {
  describe('interactions', () => {
    it('should change its state when clicked', async () => {
      render(() => <Switch.Root />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should update its state when changed from outside', () => {
      const [checked, setChecked] = createSignal(false);
      render(() => <Switch.Root checked={checked()} />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      setChecked(true);
      flush();
      expect(switchElement).toHaveAttribute('aria-checked', 'true');

      setChecked(false);
      flush();
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should update its state if the underlying input is toggled', () => {
      render(() => <Switch.Root />);
      const switchElement = screen.getByRole('switch');
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      internalInput.click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before it is handled', () => {
      const handleCheckedChange = vi.fn();
      render(() => <Switch.Root onCheckedChange={handleCheckedChange} />);

      const switchElement = screen.getByRole('switch');
      const input = screen.getByRole('checkbox', { hidden: true });
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      fireEvent(input, event);
      flush();

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    ['Enter', 'Space'].forEach((key) => {
      it(`can be activated with ${key} key`, async () => {
        render(() => <Switch.Root />);

        const switchEl = screen.getByRole('switch');
        expect(switchEl).toHaveAttribute('aria-checked', 'false');

        await userEvent.keyboard('[Tab]');
        expect(switchEl).toHaveFocus();

        await userEvent.keyboard(`[${key}]`);
        flush();
        expect(switchEl).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('extra props', () => {
    it('should override the built-in attributes', () => {
      render(() => <Switch.Root role="checkbox" data-testid="switch" />);
      expect(screen.getByTestId('switch')).toHaveAttribute('role', 'checkbox');
    });

    it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
      render(() => (
        <div>
          <label for="switch-input">Label</label>
          <Switch.Root id="switch-input" />
        </div>
      ));

      const label = screen.getByText('Label');
      await waitFor(() => {
        expect(label.id).not.toBe('');
      });
      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
      const [id, setId] = createSignal('switch-input-a');

      render(() => (
        <div>
          <label for="switch-input-a">Label A</label>
          <label for="switch-input-b">Label B</label>
          <Switch.Root id={id()} />
        </div>
      ));

      const switchEl = screen.getByRole('switch');
      const labelA = screen.getByText('Label A');

      await waitFor(() => {
        expect(labelA.id).not.toBe('');
      });
      expect(switchEl).toHaveAttribute('aria-labelledby', labelA.id);

      setId('switch-input-b');
      flush();

      const labelB = screen.getByText('Label B');
      await waitFor(() => {
        expect(labelB.id).not.toBe('');
      });
      expect(labelA.id).not.toBe(labelB.id);
      await waitFor(() => {
        expect(switchEl).toHaveAttribute('aria-labelledby', labelB.id);
      });
    });
  });

  describe('prop: onCheckedChange', () => {
    it('should call onCheckedChange when clicked', () => {
      const handleChange = vi.fn();
      render(() => <Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      switchElement.click();
      flush();

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((_checked: boolean, eventDetails: any) => eventDetails);
      render(() => <Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      const user = userEvent.setup();
      await user.keyboard('{Shift>}');
      await user.click(switchElement);
      await user.keyboard('{/Shift}');
      flush();

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('does not change state when canceled via a root click', async () => {
      render(() => (
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>
      ));

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await userEvent.click(switchElement);
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      render(() => (
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>
      ));

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      input.click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: onClick', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(() => <Switch.Root onClick={handleClick} />);
      const switchElement = screen.getByRole('switch');

      switchElement.click();
      flush();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('propagates a single click event to ancestors per user click', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Switch.Root />
        </div>
      ));

      fireEvent.click(screen.getByRole('switch'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Switch.Root onClick={(event: MouseEvent) => event.stopPropagation()} />
        </div>
      ));

      fireEvent.click(screen.getByRole('switch'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(0);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('propagates a single click event to ancestors with a native button', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Switch.Root nativeButton render={(props) => <button {...props} />} />
        </div>
      ));

      fireEvent.click(screen.getByRole('switch'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called with a native button', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Switch.Root
            nativeButton
            render={(props) => <button {...props} />}
            onClick={(event: MouseEvent) => event.stopPropagation()}
          />
        </div>
      ));

      fireEvent.click(screen.getByRole('switch'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(0);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', () => {
      render(() => <Switch.Root disabled />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not have the `disabled` attribute when `disabled` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
    });

    it('should not change its state when clicked', () => {
      render(() => <Switch.Root disabled />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', () => {
      render(() => <Switch.Root readOnly />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', () => {
      render(() => <Switch.Root readOnly />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      switchElement.click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', () => {
      render(() => (
        <label data-testid="label">
          <Switch.Root readOnly />
        </label>
      ));
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      screen.getByTestId('label').click();
      flush();

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });
      expect(input.checked).toBe(false);
    });
  });

  describe('prop: required', () => {
    it('should have the `aria-required` attribute', () => {
      render(() => <Switch.Root required />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-required', 'true');
    });

    it('should not have the aria attribute when `required` is not set', () => {
      render(() => <Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-required');
    });
  });

  describe('prop: inputRef', () => {
    it('should be able to access the native input', () => {
      const inputRef = createRef<HTMLInputElement>();
      render(() => <Switch.Root inputRef={inputRef} />);
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      expect(inputRef.current).toBe(internalInput);
    });
  });

  it('should place the style hooks on the root and the thumb', () => {
    const [disabled, setDisabled] = createSignal(true);
    const [readOnly, setReadOnly] = createSignal(true);

    render(() => (
      <Switch.Root defaultChecked disabled={disabled()} readOnly={readOnly()} required>
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>
    ));

    const switchElement = screen.getByRole('switch');
    const thumb = screen.getByTestId('thumb');

    expect(switchElement).toHaveAttribute('data-checked', '');
    expect(switchElement).toHaveAttribute('data-disabled', '');
    expect(switchElement).toHaveAttribute('data-readonly', '');
    expect(switchElement).toHaveAttribute('data-required', '');

    expect(thumb).toHaveAttribute('data-checked', '');
    expect(thumb).toHaveAttribute('data-disabled', '');
    expect(thumb).toHaveAttribute('data-readonly', '');
    expect(thumb).toHaveAttribute('data-required', '');

    setDisabled(false);
    setReadOnly(false);
    flush();
    fireEvent.click(switchElement);
    flush();

    expect(switchElement).toHaveAttribute('data-unchecked', '');
    expect(switchElement).not.toHaveAttribute('data-checked');

    expect(thumb).toHaveAttribute('data-unchecked', '');
    expect(thumb).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', () => {
    render(() => <Switch.Root name="switch-name" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'switch-name');
    expect(switchElement).not.toHaveAttribute('name');
  });

  it('should not set the value attribute by default', () => {
    render(() => <Switch.Root />);

    const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

    expect(input).not.toHaveAttribute('value');
    // The native checkbox submission value applies.
    expect(input.value).toBe('on');
  });

  it('should set the value attribute only on the input', () => {
    render(() => <Switch.Root value="1" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('value', '1');
    expect(switchElement).not.toHaveAttribute('value');
  });

  describe('prop: uncheckedValue', () => {
    it('renders a hidden input carrying uncheckedValue only while off', () => {
      const { container } = render(() => (
        <Switch.Root name="test-switch" uncheckedValue="off" defaultChecked={false} />
      ));

      const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
      expect(hidden).not.toBe(null);
      expect(hidden).toHaveAttribute('name', 'test-switch');
      expect(hidden!.value).toBe('off');

      screen.getByRole('switch').click();
      flush();

      expect(container.querySelector('input[type="hidden"]')).toBe(null);

      screen.getByRole('switch').click();
      flush();

      expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')!.value).toBe('off');
    });

    it('does not render the unchecked hidden input without a name', () => {
      const { container } = render(() => <Switch.Root uncheckedValue="off" />);
      expect(container.querySelector('input[type="hidden"]')).toBe(null);
    });

    it('disables the unchecked hidden input when disabled', () => {
      const { container } = render(() => (
        <Switch.Root name="test-switch" uncheckedValue="off" disabled />
      ));

      const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"]');
      expect(hidden).toBeDisabled();
    });
  });

  describe('with native <label>', () => {
    it('should toggle the switch when a wrapping <label> is clicked', async () => {
      render(() => (
        <label data-testid="label">
          <Switch.Root />
          Toggle
        </label>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await userEvent.click(screen.getByTestId('label'));
      flush();
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the switch when a explicitly linked <label> is clicked', async () => {
      render(() => (
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" />
        </div>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await userEvent.click(screen.getByTestId('label'));
      flush();
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      render(() => (
        <div>
          <label data-testid="label" for="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" nativeButton render={(props) => <button {...props} />} />
        </div>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('id', 'mySwitch');

      const hiddenInput = screen.getByRole('checkbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('id', 'mySwitch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      await userEvent.click(screen.getByTestId('label'));
      flush();
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    function getFormValue(name: string) {
      const form = screen.getByTestId('form') as HTMLFormElement;
      return new FormData(form).get(name);
    }

    it('should include the switch value in form data, matching native checkbox behavior', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-switch">
            <Switch.Root />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-switch')).toBe(null);

      screen.getByRole('switch').click();
      flush();

      expect(getFormValue('test-switch')).toBe('on');
    });

    it('includes the switch in an external form when `form` is provided', () => {
      render(() => (
        <div>
          <form id="external-form" data-testid="form" />
          <Switch.Root name="test-switch" defaultChecked form="external-form" />
        </div>
      ));

      expect(getFormValue('test-switch')).toBe('on');
    });

    it('submits uncheckedValue when the switch is off and uncheckedValue is specified', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-switch">
            <Switch.Root uncheckedValue="off" />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-switch')).toBe('off');

      screen.getByRole('switch').click();
      flush();
      expect(getFormValue('test-switch')).toBe('on');

      screen.getByRole('switch').click();
      flush();
      expect(getFormValue('test-switch')).toBe('off');
    });

    it('submits custom value and uncheckedValue across an off/on/off cycle', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-switch">
            <Switch.Root value="yes" uncheckedValue="no" />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-switch')).toBe('no');

      screen.getByRole('switch').click();
      flush();
      expect(getFormValue('test-switch')).toBe('yes');

      screen.getByRole('switch').click();
      flush();
      expect(getFormValue('test-switch')).toBe('no');
    });

    it('does not submit uncheckedValue when disabled', () => {
      render(() => (
        <form data-testid="form">
          <Switch.Root name="test-switch" uncheckedValue="off" disabled />
        </form>
      ));

      expect(getFormValue('test-switch')).toBe(null);
    });

    it('triggers native HTML validation on submit', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test">
            <Switch.Root name="switch" required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect(screen.getByTestId('error')).toHaveTextContent('required');
    });

    it('clears external errors on change', () => {
      render(() => (
        <Form errors={{ test: 'test' }}>
          <Field.Root name="test" data-testid="field">
            <Switch.Root data-testid="switch" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const switchElement = screen.getByTestId('switch');

      expect(switchElement).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      fireEvent.click(switchElement);
      flush();
      flush();

      expect(switchElement).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('Field', () => {
    it('prop: validationMode=onSubmit', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root>
            <Switch.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const button = screen.getByRole('switch');
      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.submit(screen.getByTestId('form'));
      flush();
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);

      fireEvent.click(button);
      flush();
      flush();
      expect(button).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.click(button);
      flush();
      flush();
      expect(button).toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('should receive disabled prop from Field.Root', () => {
      render(() => (
        <Field.Root disabled>
          <Switch.Root />
        </Field.Root>
      ));

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-disabled');
    });

    it('should receive name prop from Field.Root', () => {
      render(() => (
        <Field.Root name="field-switch">
          <Switch.Root />
        </Field.Root>
      ));

      const input = screen.getByRole('checkbox', { hidden: true });
      expect(input).toHaveAttribute('name', 'field-switch');
    });

    it('[data-touched]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      fireEvent.blur(button);
      flush();

      expect(button).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-dirty');

      fireEvent.click(button);
      flush();
      flush();

      expect(button).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when checked after being initially unchecked', () => {
        render(() => (
          <Field.Root>
            <Switch.Root data-testid="button" />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');

        expect(button).not.toHaveAttribute('data-filled');

        fireEvent.click(button);
        flush();
        flush();

        expect(button).toHaveAttribute('data-filled', '');

        fireEvent.click(button);
        flush();
        flush();

        expect(button).not.toHaveAttribute('data-filled');
      });

      it('clears [data-filled] when a controlled switch remounts unchecked', () => {
        const [unchecked, setUnchecked] = createSignal(false);

        render(() => (
          <Field.Root data-testid="root">
            <Show
              when={unchecked()}
              fallback={<Switch.Root checked onCheckedChange={() => {}} />}
            >
              <Switch.Root checked={false} onCheckedChange={() => {}} />
            </Show>
          </Field.Root>
        ));

        const root = screen.getByTestId('root');
        flush();
        expect(root).toHaveAttribute('data-filled', '');

        setUnchecked(true);
        flush();
        flush();

        expect(root).not.toHaveAttribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', () => {
        render(() => (
          <Field.Root>
            <Switch.Root data-testid="button" defaultChecked />
          </Field.Root>
        ));

        const button = screen.getByTestId('button');
        flush();

        expect(button).toHaveAttribute('data-filled');

        fireEvent.click(button);
        flush();
        flush();

        expect(button).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-focused');

      fireEvent.focus(button);
      flush();

      expect(button).toHaveAttribute('data-focused', '');

      fireEvent.blur(button);
      flush();

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('does not set [data-focused] when disabled', () => {
      render(() => (
        <Field.Root>
          <Switch.Root disabled data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      flush();

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('prop: validationMode=onChange', () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.click(button);
      flush();
      flush();

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('validates once when changed by the user', async () => {
      const validate = vi.fn();

      render(() => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Switch.Root />
        </Field.Root>
      ));

      await userEvent.click(screen.getByRole('switch'));
      flush();
      flush();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));
      const [checked, setChecked] = createSignal(false);

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="newsletters">
          <Switch.Root data-testid="button" checked={checked()} onCheckedChange={setChecked} />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      setChecked(true);
      flush();
      flush();

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe(true);
      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', () => {
      render(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.click(button);
      flush();
      fireEvent.blur(button);
      flush();
      flush();

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    describe('Field.Label', () => {
      describe('implicit', () => {
        it('sets `for` on the label', async () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">
                <Switch.Root />
                OK
              </Field.Label>
            </Field.Root>
          ));

          flush();
          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const switchEl = screen.getByRole('switch');
          await waitFor(() => {
            expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });
          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          flush();
          expect(switchEl).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('explicit association', () => {
        it('when the label is sibling to the switch', async () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              <Switch.Root />
            </Field.Root>
          ));

          flush();
          const label = screen.getByTestId('label');
          const switchEl = screen.getByRole('switch');
          const input = document.querySelector('input[type="checkbox"]');

          expect(label.getAttribute('for')).not.toBe(null);

          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));
          await waitFor(() => {
            expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });

          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          flush();
          expect(switchEl).toHaveAttribute('aria-checked', 'true');
        });

        it('when rendering a non-native button', async () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">OK</Field.Label>
              <Switch.Root render={(props) => <span {...props} />} nativeButton={false} />
            </Field.Root>
          ));

          flush();
          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);
          const input = document.querySelector('input[type="checkbox"]');
          expect(input?.getAttribute('id')).toBe(label.getAttribute('for'));
          const switchEl = screen.getByRole('switch');
          await waitFor(() => {
            expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });
        });

        it('when rendering a non-native label', async () => {
          render(() => (
            <Field.Root>
              <Field.Label
                data-testid="label"
                render={(props) => <span {...props} />}
                nativeLabel={false}
              >
                <Switch.Root data-testid="button" />
              </Field.Label>
            </Field.Root>
          ));

          flush();
          const label = screen.getByTestId('label');
          const switchEl = screen.getByRole('switch');

          expect(label.getAttribute('for')).toBe(null);
          expect(label.getAttribute('id')).not.toBe(null);

          await waitFor(() => {
            expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });
          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          // non-native labels cannot toggle a non-native-button switch
          fireEvent.click(label);
          flush();
          expect(switchEl).not.toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', () => {
      render(() => (
        <Field.Root>
          <Switch.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      flush();
      const internalInput = screen.queryByRole<HTMLInputElement>('checkbox', { hidden: true });
      const description = screen.getByTestId('description');

      expect(internalInput).toHaveAttribute('aria-describedby', description.id);
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-describedby',
        `external-description ${description.id}`,
      );
    });
  });

  it('can render a native button', async () => {
    const { container } = render(() => (
      <Switch.Root render={(props) => <button {...props} />} nativeButton />
    ));

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('button')).toBe(switchEl);

    await userEvent.keyboard('[Tab]');
    expect(switchEl).toHaveFocus();

    await userEvent.keyboard('[Enter]');
    flush();
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard('[Space]');
    flush();
    expect(switchEl).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(switchEl);
    flush();
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });
});
