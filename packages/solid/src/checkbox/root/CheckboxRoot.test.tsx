import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../index';
import { CheckboxGroup } from '../../checkbox-group';
import { Field } from '../../field';
import { Form } from '../../form';
import { createRef } from '../../solid-utils/refs';

describe('<Checkbox.Root />', () => {
  describe('ARIA attributes', () => {
    it('sets the correct aria attributes', () => {
      const [required, setRequired] = createSignal(false);
      render(() => <Checkbox.Root data-testid="test" required={required()} />);

      expect(screen.getByRole('checkbox')).toBe(screen.getByTestId('test'));
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked');

      setRequired(true);
      flush();
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('extra props', () => {
    it('can override the built-in attributes', () => {
      const { container } = render(() => <Checkbox.Root role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('id', () => {
    [false, true].forEach((nativeButton) => {
      it(`drops an explicit id when the prop is removed (nativeButton=${nativeButton})`, async () => {
        const [id, setId] = createSignal<string | undefined>('explicit');

        render(() => (
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            <Checkbox.Root
              id={id()}
              nativeButton={nativeButton}
              render={nativeButton ? (props) => <button {...props} /> : undefined}
            />
          </Field.Root>
        ));

        function getLabelControl() {
          return nativeButton
            ? screen.getByRole('checkbox')
            : document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        }

        const label = screen.getByTestId('label');
        await waitFor(() => {
          expect(getLabelControl()).toHaveAttribute('id', 'explicit');
        });
        expect(label).toHaveAttribute('for', 'explicit');

        setId(undefined);
        flush();

        await waitFor(() => {
          expect(getLabelControl()).not.toHaveAttribute('id', 'explicit');
        });
        const control = getLabelControl();
        expect(control.id).not.toBe('');
        expect(label).toHaveAttribute('for', control.id);
      });
    });
  });

  describe('prop: onClick', () => {
    it('propagates a single click event to ancestors per user click', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root data-testid="checkbox" />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root
            data-testid="checkbox"
            onClick={(event: MouseEvent) => event.stopPropagation()}
          />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(0);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('propagates a single click event to ancestors with a native button', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root nativeButton render={(props) => <button {...props} />} data-testid="checkbox" />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called with a native button', () => {
      const handleParentClick = vi.fn();
      render(() => (
        <div onClick={handleParentClick}>
          <Checkbox.Root
            nativeButton
            render={(props) => <button {...props} />}
            data-testid="checkbox"
            onClick={(event: MouseEvent) => event.stopPropagation()}
          />
        </div>
      ));

      fireEvent.click(screen.getByTestId('checkbox'));
      flush();

      expect(handleParentClick).toHaveBeenCalledTimes(0);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('interactions', () => {
    it('tolerates imperative interaction in its ref callback before the hidden input mounts', () => {
      render(() => (
        <Checkbox.Root
          ref={(element: HTMLElement | null) => {
            if (element) {
              element.focus();
              element.blur();
              element.click();
            }
          }}
        />
      ));
      flush();

      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    });

    it('should change its state when clicked', () => {
      render(() => <Checkbox.Root />);
      const [checkbox] = screen.getAllByRole('checkbox');
      // querying it separately since hidden true returns both button and input.
      // without hidden it only returns the button (in the above query)
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(input.checked).toBe(true);

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should update its state when changed from outside', () => {
      const [checked, setChecked] = createSignal(false);
      render(() => <Checkbox.Root checked={checked()} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      setChecked(true);
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');

      setChecked(false);
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should call onCheckedChange when clicked', () => {
      const handleChange = vi.fn();
      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      checkbox.click();
      flush();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
    });

    it('does not update its state when onCheckedChange cancels the event', () => {
      const handleChange = vi.fn((_checked: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const checkbox = screen.getByRole('checkbox');
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      fireEvent.click(checkbox);
      flush();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((_checked: boolean, eventDetails: any) => eventDetails);
      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      const user = userEvent.setup();
      await user.keyboard('{Shift>}');
      await user.click(checkbox);
      await user.keyboard('{/Shift}');
      flush();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should update its state if the underlying input is toggled', () => {
      render(() => <Checkbox.Root />);
      const checkbox = screen.getByRole('checkbox');
      const internalInput = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

      internalInput?.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores a hidden input click canceled before it is handled', () => {
      const handleCheckedChange = vi.fn();
      render(() => <Checkbox.Root onCheckedChange={handleCheckedChange} />);

      const checkbox = screen.getByRole('checkbox');
      const input = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true })[1];
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      event.preventDefault();

      fireEvent(input, event);
      flush();

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('can be activated with Space key', async () => {
      render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await userEvent.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await userEvent.keyboard('[Space]');
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('does not activate with Enter key', async () => {
      render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await userEvent.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await userEvent.keyboard('[Enter]');
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', () => {
      render(() => <Checkbox.Root disabled />);
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not change its state when clicked', () => {
      render(() => <Checkbox.Root disabled />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', () => {
      render(() => <Checkbox.Root readOnly />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', () => {
      render(() => <Checkbox.Root readOnly />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root readOnly />
        </label>
      ));
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      screen.getByTestId('label').click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true });
      expect(input.checked).toBe(false);
    });
  });

  describe('prop: indeterminate', () => {
    it('should set the `aria-checked` attribute as "mixed"', () => {
      render(() => <Checkbox.Root indeterminate />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not change its state when clicked', () => {
      render(() => <Checkbox.Root indeterminate />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not have the aria attribute when `indeterminate` is not set', () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not be overridden by `checked` prop', () => {
      render(() => <Checkbox.Root indeterminate checked />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('sets the native input state when indeterminate', () => {
      render(() => <Checkbox.Root indeterminate />);
      flush();

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });

    it('keeps the native input state when checked changes while indeterminate remains', () => {
      const [checked, setChecked] = createSignal(false);
      render(() => (
        <Checkbox.Root
          data-testid="button"
          indeterminate
          checked={checked()}
          onCheckedChange={setChecked}
        />
      ));
      flush();

      // Clicking the hidden input natively clears `indeterminate` before toggling.
      fireEvent.click(screen.getByTestId('button'));
      flush();

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.checked).toBe(true);
      expect(input.indeterminate).toBe(true);
    });

    it('sets indeterminate style hooks on the root and indicator', () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>
      ));

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-indeterminate', '');
      expect(screen.getByTestId('indicator')).toHaveAttribute('data-indeterminate', '');
    });

    it('sets grouped parent aria when manually indeterminate', () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('sets grouped parent native input state when manually indeterminate', () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));
      flush();

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });
  });

  it('should place the style hooks on the root and the indicator', () => {
    const [disabled, setDisabled] = createSignal(true);
    const [readOnly, setReadOnly] = createSignal(true);

    render(() => (
      <Checkbox.Root defaultChecked disabled={disabled()} readOnly={readOnly()} required>
        <Checkbox.Indicator />
      </Checkbox.Root>
    ));

    const [checkbox] = screen.getAllByRole('checkbox');
    const indicator = checkbox.querySelector('span');

    expect(checkbox).toHaveAttribute('data-checked', '');
    expect(checkbox).not.toHaveAttribute('data-unchecked');

    expect(checkbox).toHaveAttribute('data-disabled', '');
    expect(checkbox).toHaveAttribute('data-readonly', '');
    expect(checkbox).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).not.toHaveAttribute('data-unchecked');

    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');

    setDisabled(false);
    setReadOnly(false);
    flush();
    fireEvent.click(checkbox);
    flush();

    expect(checkbox).toHaveAttribute('data-unchecked', '');
    expect(checkbox).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', () => {
    render(() => <Checkbox.Root name="checkbox-name" />);

    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });
    expect(input).toHaveAttribute('name', 'checkbox-name');
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('name');
  });

  describe('with native <label>', () => {
    it('should toggle the checkbox when a wrapping <label> is clicked', () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root />
          Toggle
        </label>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the checkbox when a explicitly linked <label> is clicked', () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" />
        </div>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" nativeButton render={(props) => <button {...props} />} />
        </div>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'myCheckbox');

      const hiddenInputs = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true });
      const hiddenInput = hiddenInputs.find((input) => input !== checkbox);
      expect(hiddenInput).not.toBe(undefined);
      expect(hiddenInput).not.toHaveAttribute('id', 'myCheckbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(screen.getByTestId('label'));
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('falls back to the Field control id when id is empty', async () => {
      render(() => (
        <Field.Root>
          <Field.Label>Label</Field.Label>
          <Checkbox.Root id="" />
        </Field.Root>
      ));
      flush();

      const label = screen.getByText('Label');
      const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      const checkbox = screen.getByRole('checkbox');

      await waitFor(() => {
        expect(input.id).not.toBe('');
      });
      expect(label).toHaveAttribute('for', input.id);

      fireEvent.click(label);
      flush();
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('assigns an input id to a valueless child in a parent checkbox group', async () => {
      render(() => (
        <CheckboxGroup allValues={['one']}>
          <Checkbox.Root />
        </CheckboxGroup>
      ));

      const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      await waitFor(() => {
        expect(input.id).not.toBe('');
      });
    });

    it('assigns a root id to a valueless native button in a parent checkbox group', async () => {
      render(() => (
        <CheckboxGroup allValues={['one']}>
          <Checkbox.Root nativeButton render={(props) => <button {...props} />} />
        </CheckboxGroup>
      ));

      await waitFor(() => {
        expect(screen.getByRole('checkbox').id).not.toBe('');
      });
    });
  });

  describe('Form', () => {
    function getFormValue(name: string) {
      const form = screen.getByTestId('form') as HTMLFormElement;
      return new FormData(form).get(name);
    }

    it('triggers native HTML validation on submit', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root required />
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

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('clears external errors on change', () => {
      render(() => (
        <Form errors={{ test: 'test' }}>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root data-testid="checkbox" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const checkbox = screen.getByTestId('checkbox');

      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      fireEvent.click(checkbox);
      flush();
      flush();

      expect(checkbox).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('should include the checkbox value in form data, matching native checkbox behavior', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-checkbox">
            <Checkbox.Root />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-checkbox')).toBe(null);

      screen.getByRole('checkbox').click();
      flush();

      expect(getFormValue('test-checkbox')).toBe('on');
    });

    it('should include the custom checkbox value in form data', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-checkbox">
            <Checkbox.Root value="test-value" />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-checkbox')).toBe(null);

      screen.getByRole('checkbox').click();
      flush();

      expect(getFormValue('test-checkbox')).toBe('test-value');
    });

    it('includes the checkbox in an external form when `form` is provided', () => {
      render(() => (
        <div>
          <form id="external-form" data-testid="form" />
          <Checkbox.Root name="test-checkbox" defaultChecked form="external-form" />
        </div>
      ));

      expect(getFormValue('test-checkbox')).toBe('on');
    });

    it('submits uncheckedValue when the checkbox is unchecked and uncheckedValue is specified', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-checkbox">
            <Checkbox.Root uncheckedValue="off" />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-checkbox')).toBe('off');

      screen.getByRole('checkbox').click();
      flush();
      expect(getFormValue('test-checkbox')).toBe('on');

      screen.getByRole('checkbox').click();
      flush();
      expect(getFormValue('test-checkbox')).toBe('off');
    });

    it('submits custom value and uncheckedValue across an unchecked/checked cycle', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="test-checkbox">
            <Checkbox.Root uncheckedValue="false" value="true" />
          </Field.Root>
        </Form>
      ));

      expect(getFormValue('test-checkbox')).toBe('false');

      screen.getByRole('checkbox').click();
      flush();
      expect(getFormValue('test-checkbox')).toBe('true');
    });

    it('does not submit uncheckedValue when disabled', () => {
      render(() => (
        <form data-testid="form">
          <Checkbox.Root name="test-checkbox" uncheckedValue="off" disabled />
        </form>
      ));

      expect(getFormValue('test-checkbox')).toBe(null);
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', () => {
      render(() => (
        <Field.Root disabled>
          <Checkbox.Root />
        </Field.Root>
      ));

      const [checkbox] = screen.getAllByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should receive name prop from Field.Root', () => {
      render(() => (
        <Field.Root name="field-checkbox">
          <Checkbox.Root />
        </Field.Root>
      ));

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input).toHaveAttribute('name', 'field-checkbox');
    });

    it('[data-touched]', () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root data-testid="button" />
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
            <Checkbox.Root data-testid="button" />
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

      it('removes [data-filled] attribute when unchecked after being initially checked', () => {
        render(() => (
          <Field.Root>
            <Checkbox.Root data-testid="button" defaultChecked />
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

      it('clears [data-filled] when a controlled checkbox remounts unchecked', () => {
        const [unchecked, setUnchecked] = createSignal(false);

        render(() => (
          <Field.Root data-testid="root">
            <Show
              when={unchecked()}
              fallback={<Checkbox.Root checked onCheckedChange={() => {}} />}
            >
              <Checkbox.Root checked={false} onCheckedChange={() => {}} />
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

      it('adds [data-filled] attribute when any checkbox is filled when inside a group', () => {
        render(() => (
          <Field.Root>
            <CheckboxGroup defaultValue={['1', '2']}>
              <Checkbox.Root name="1" data-testid="button-1" />
              <Checkbox.Root name="2" data-testid="button-2" />
            </CheckboxGroup>
          </Field.Root>
        ));
        flush();

        const button1 = screen.getByTestId('button-1');
        const button2 = screen.getByTestId('button-2');

        expect(button1).toHaveAttribute('data-filled');
        expect(button2).toHaveAttribute('data-filled');

        fireEvent.click(button1);
        flush();
        flush();

        expect(button1).toHaveAttribute('data-filled');
        expect(button2).toHaveAttribute('data-filled');

        fireEvent.click(button2);
        flush();
        flush();

        expect(button1).not.toHaveAttribute('data-filled');
        expect(button2).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      flush();

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('[data-invalid]', () => {
      render(() => (
        <Field.Root invalid>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', () => {
      render(() => (
        <Field.Root validationMode="onBlur">
          <Checkbox.Root data-testid="button" required />
        </Field.Root>
      ));

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-valid');
      expect(button).not.toHaveAttribute('data-invalid');

      // Check the checkbox and trigger validation
      fireEvent.click(button);
      flush();
      fireEvent.focus(button);
      fireEvent.blur(button);
      flush();
      flush();

      expect(button).toHaveAttribute('data-valid', '');
      expect(button).not.toHaveAttribute('data-invalid');
    });

    it('prop: validationMode=onSubmit', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root>
            <Checkbox.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      flush();
      expect(checkbox).toHaveAttribute('data-checked', '');
      fireEvent.click(checkbox);
      flush();
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.submit(screen.getByTestId('form'));
      flush();
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');

      fireEvent.click(checkbox);
      flush();
      flush();
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      flush();
      flush();
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      flush();
      flush();
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');
    });

    it('props: validationMode=onChange', () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root />
        </Field.Root>
      ));

      await userEvent.click(screen.getByRole('checkbox'));
      flush();
      flush();

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));
      const [checked, setChecked] = createSignal(false);

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="terms">
          <Checkbox.Root data-testid="button" checked={checked()} onCheckedChange={setChecked} />
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
          <Checkbox.Root data-testid="button" />
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
      describe('explicit association', () => {
        it('when label and checkbox are siblings', async () => {
          render(() => (
            <Field.Root>
              <Field.Label>Label</Field.Label>
              <Checkbox.Root />
            </Field.Root>
          ));
          flush();

          const label = screen.getByText('Label');
          expect(label.getAttribute('id')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          await waitFor(() => {
            expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });
          expect(checkbox).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          flush();
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('implicit association', () => {
        it('sets `for` on the label', async () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">
                <Checkbox.Root />
                OK
              </Field.Label>
            </Field.Root>
          ));
          flush();

          const label = screen.getByTestId('label');
          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).not.toBe(null);
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(label.getAttribute('id')).not.toBe(null);
          await waitFor(() => {
            expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          });

          expect(checkbox).toHaveAttribute('aria-checked', 'false');
          fireEvent.click(screen.getByText('OK'));
          flush();
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));
      flush();

      const internalInput = screen.getByRole<HTMLInputElement>('checkbox');

      expect(internalInput).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  it('should change state when clicking the checkbox if it has a wrapping label', () => {
    render(() => (
      <label data-testid="label">
        <Checkbox.Root />
        Toggle
      </label>
    ));

    const [checkbox] = screen.getAllByRole('checkbox');

    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(checkbox);
    flush();

    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(checkbox);
    flush();

    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    render(() => (
      <div>
        <label for="checkbox-input">Label</label>
        <Checkbox.Root id="checkbox-input" />
      </div>
    ));

    const label = screen.getByText('Label');
    await waitFor(() => {
      expect(label.id).not.toBe('');
    });
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    const [id, setId] = createSignal('checkbox-input-a');

    render(() => (
      <div>
        <label for="checkbox-input-a">Label A</label>
        <label for="checkbox-input-b">Label B</label>
        <Checkbox.Root id={id()} />
      </div>
    ));

    const checkbox = screen.getByRole('checkbox');
    const labelA = screen.getByText('Label A');

    await waitFor(() => {
      expect(labelA.id).not.toBe('');
    });
    expect(checkbox).toHaveAttribute('aria-labelledby', labelA.id);

    setId('checkbox-input-b');
    flush();

    const labelB = screen.getByText('Label B');
    await waitFor(() => {
      expect(labelB.id).not.toBe('');
    });
    expect(labelA.id).not.toBe(labelB.id);
    await waitFor(() => {
      expect(checkbox).toHaveAttribute('aria-labelledby', labelB.id);
    });
  });

  it('can render a native button', async () => {
    const { container } = render(() => (
      <Checkbox.Root render={(props) => <button {...props} />} nativeButton />
    ));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('button')).toBe(checkbox);

    await userEvent.keyboard('[Tab]');
    expect(checkbox).toHaveFocus();

    await userEvent.keyboard('[Enter]');
    flush();
    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await userEvent.keyboard('[Space]');
    flush();
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(checkbox);
    flush();
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });
});
