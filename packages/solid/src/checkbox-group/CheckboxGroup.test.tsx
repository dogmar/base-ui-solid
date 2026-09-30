import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { CheckboxGroup } from './index';
import { Checkbox } from '../checkbox';
import { Field } from '../field';
import { Form } from '../form';

describe('<CheckboxGroup />', () => {
  it('renders a div with role group', () => {
    render(() => <CheckboxGroup data-testid="group" />);
    expect(screen.getByTestId('group').tagName).toBe('DIV');
    expect(screen.getByTestId('group')).toHaveAttribute('role', 'group');
  });

  describe('prop: id', () => {
    it('is forwarded to the root element', () => {
      render(() => <CheckboxGroup id="group-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: value', () => {
    it('should control the value', () => {
      const [value, setValue] = createSignal(['red']);
      render(() => (
        <CheckboxGroup value={value()} onValueChange={setValue}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(green);
      flush();

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(blue);
      flush();

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(green);
      flush();

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'true');
    });

    it('supports an empty string item value', () => {
      const [value, setValue] = createSignal(['']);
      render(() => (
        <CheckboxGroup value={value()} onValueChange={setValue}>
          <Checkbox.Root value="" data-testid="empty" />
          <Checkbox.Root value="other" data-testid="other" />
        </CheckboxGroup>
      ));

      const empty = screen.getByTestId('empty');
      const other = screen.getByTestId('other');

      expect(empty).toHaveAttribute('aria-checked', 'true');
      expect(other).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(empty);
      flush();

      expect(empty).toHaveAttribute('aria-checked', 'false');
    });

    it('treats a controlled value that becomes undefined as an empty array', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const [value, setValue] = createSignal<string[] | undefined>(['red']);

      try {
        render(() => (
          <CheckboxGroup value={value()}>
            <Checkbox.Root value="red" data-testid="red" />
          </CheckboxGroup>
        ));

        expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'true');

        setValue(undefined);
        flush();

        expect(screen.getByTestId('red')).toHaveAttribute('aria-checked', 'false');
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', () => {
      const handleValueChange = vi.fn();
      const [value, setValue] = createSignal<string[]>([]);

      render(() => (
        <CheckboxGroup
          value={value()}
          onValueChange={(nextValue) => {
            setValue(nextValue);
            handleValueChange(nextValue);
          }}
        >
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      fireEvent.click(red);
      flush();

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      fireEvent.click(green);
      flush();

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      fireEvent.click(blue);
      flush();

      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual(['red', 'green', 'blue']);
    });

    it('should treat an omitted defaultValue as an empty array', () => {
      const handleValueChange = vi.fn();

      render(() => (
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      fireEvent.click(red);
      flush();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      fireEvent.click(green);
      flush();

      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      fireEvent.click(red);
      flush();

      expect(handleValueChange.mock.calls[2][0]).toEqual(['green']);
    });

    it('does not update the group when onValueChange cancels the event', () => {
      const handleValueChange = vi.fn(
        (_value: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      render(() => (
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root value="red" data-testid="red" />
          <Checkbox.Root value="green" data-testid="green" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      fireEvent.click(red);
      flush();

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);
      expect(red).toHaveAttribute('aria-checked', 'false');
      expect(green).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('treats null as an empty array', () => {
      // @ts-expect-error Simulates a JavaScript consumer passing an unsupported value.
      render(() => <CheckboxGroup defaultValue={null} />);

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('should set the initial value', () => {
      render(() => (
        <CheckboxGroup defaultValue={['red']}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(green);
      flush();

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');
    });

    it('keeps omitted defaults isolated between groups', async () => {
      render(() => (
        <div>
          <CheckboxGroup allValues={['a-1', 'a-2']}>
            <Checkbox.Root parent data-testid="a-parent" />
            <Checkbox.Root value="a-1" data-testid="a-1" />
            <Checkbox.Root value="a-2" data-testid="a-2" />
          </CheckboxGroup>
          <CheckboxGroup allValues={['b-1', 'b-2']}>
            <Checkbox.Root parent data-testid="b-parent" />
            <Checkbox.Root value="b-1" data-testid="b-1" />
            <Checkbox.Root value="b-2" data-testid="b-2" />
          </CheckboxGroup>
        </div>
      ));

      const aParent = screen.getByTestId('a-parent');
      const a1 = screen.getByTestId('a-1');
      const a2 = screen.getByTestId('a-2');
      const bParent = screen.getByTestId('b-parent');
      const b1 = screen.getByTestId('b-1');
      const b2 = screen.getByTestId('b-2');

      await userEvent.click(a1);
      flush();
      expect(aParent).toHaveAttribute('aria-checked', 'mixed');
      expect(bParent).toHaveAttribute('aria-checked', 'false');
      expect(b1).toHaveAttribute('aria-checked', 'false');
      expect(b2).toHaveAttribute('aria-checked', 'false');

      await userEvent.click(bParent);
      flush();
      expect(b1).toHaveAttribute('aria-checked', 'true');
      expect(b2).toHaveAttribute('aria-checked', 'true');
      expect(a1).toHaveAttribute('aria-checked', 'true');
      expect(a2).toHaveAttribute('aria-checked', 'false');

      await userEvent.click(aParent);
      flush();
      expect(a1).toHaveAttribute('aria-checked', 'true');
      expect(a2).toHaveAttribute('aria-checked', 'true');
      expect(bParent).toHaveAttribute('aria-checked', 'true');

      await userEvent.click(b1);
      flush();
      expect(bParent).toHaveAttribute('aria-checked', 'mixed');
      expect(aParent).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('disables all checkboxes when `true`', () => {
      render(() => (
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not disable all checkboxes when `false`', () => {
      render(() => (
        <CheckboxGroup disabled={false}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).not.toHaveAttribute('aria-disabled', 'true');
      expect(green).not.toHaveAttribute('aria-disabled', 'true');
      expect(blue).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('takes precedence over individual checkboxes', () => {
      render(() => (
        <CheckboxGroup disabled>
          <Checkbox.Root name="red" data-testid="red" disabled={false} />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>
      ));

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Field', () => {
    it('[data-dirty]', () => {
      render(() => (
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['apple']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="banana" data-testid="banana" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const group = screen.getByRole('group');
      const banana = screen.getByTestId('banana');

      expect(group).not.toHaveAttribute('data-dirty');

      fireEvent.click(banana);
      flush();
      flush();

      expect(group).toHaveAttribute('data-dirty', '');

      fireEvent.click(banana);
      flush();
      flush();

      expect(group).not.toHaveAttribute('data-dirty');
    });

    it('[data-filled] follows the group value even without a matching rendered checkbox', () => {
      render(() => (
        <Field.Root name="fruits">
          <CheckboxGroup defaultValue={['cherry']}>
            <Field.Item>
              <Checkbox.Root value="apple" data-testid="apple" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const group = screen.getByRole('group');
      const apple = screen.getByTestId('apple');

      expect(group).toHaveAttribute('data-filled', '');

      fireEvent.click(apple);
      flush();
      flush();
      fireEvent.click(apple);
      flush();
      flush();

      expect(group).toHaveAttribute('data-filled', '');
    });

    it('keeps a required error while another required checkbox in the group is unchecked', async () => {
      render(() => (
        <Form data-testid="form" onSubmit={(event: Event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="checkbox" required />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      flush();

      const checkboxes = screen.getAllByTestId('checkbox');
      const form = screen.getByTestId('form');

      fireEvent.submit(form);
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking only one of the two required checkboxes must not clear the error.
      await userEvent.click(checkboxes[1]);
      flush();
      flush();
      fireEvent.submit(form);
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await userEvent.click(checkboxes[0]);
      flush();
      flush();
      fireEvent.submit(form);
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('ignores a disabled required checkbox when validating the group', async () => {
      render(() => (
        <Form data-testid="form" onSubmit={(event: Event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-enabled" required />
              </Field.Item>
              {/* Mounted last so it would otherwise win the shared input ref. */}
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-disabled" required disabled />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      flush();

      const form = screen.getByTestId('form');

      fireEvent.submit(form);
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // A disabled checkbox is exempt from constraint validation, so checking the only
      // enabled required checkbox is enough to satisfy the field.
      await userEvent.click(screen.getByTestId('cb-enabled'));
      flush();
      flush();
      fireEvent.submit(form);
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('keeps validating the remaining required checkbox after a checked sibling unmounts', async () => {
      const [showHttps, setShowHttps] = createSignal(true);

      render(() => (
        <Form data-testid="form" onSubmit={(event: Event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="checkbox-http" required />
              </Field.Item>
              <Show when={showHttps()}>
                <Field.Item>
                  <Checkbox.Root value="https" data-testid="checkbox-https" required />
                </Field.Item>
              </Show>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      flush();

      const form = screen.getByTestId('form');

      fireEvent.submit(form);
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Check `https` (the last-mounted input that wins the shared ref), then unmount it. The shared
      // ref is now nulled, so only the registry can keep validating the still-unchecked `http`.
      await userEvent.click(screen.getByTestId('checkbox-https'));
      flush();
      flush();
      setShowHttps(false);
      flush();
      fireEvent.submit(form);
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking the remaining required checkbox satisfies the field.
      await userEvent.click(screen.getByTestId('checkbox-http'));
      flush();
      flush();
      fireEvent.submit(form);
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onChange keeps the error until every required checkbox is ticked', async () => {
      render(() => (
        <Field.Root name="protocols" validationMode="onChange">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>
      ));
      flush();

      expect(screen.queryByTestId('error')).toBe(null);

      // Ticking the second (last-mounted) checkbox must not clear the requirement on the first.
      await userEvent.click(screen.getByTestId('cb-https'));
      flush();
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await userEvent.click(screen.getByTestId('cb-http'));
      flush();
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onBlur keeps the error until every required checkbox is ticked', async () => {
      render(() => (
        <Field.Root name="protocols" validationMode="onBlur">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>
      ));
      flush();

      await userEvent.click(screen.getByTestId('cb-https'));
      flush();
      flush();
      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.blur(screen.getByTestId('cb-https'));
      flush();
      flush();
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await userEvent.click(screen.getByTestId('cb-http'));
      flush();
      flush();
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('does not leave a stale custom error when toggling checkboxes in a group', () => {
      const validateSpy = vi.fn((value: unknown) =>
        (value as string[]).length < 2 ? 'pick two' : null,
      );
      render(() => (
        <Field.Root name="protocols" validationMode="onChange" validate={validateSpy}>
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const http = screen.getByTestId('cb-http');
      const https = screen.getByTestId('cb-https');

      fireEvent.click(http);
      flush();
      flush();
      expect(http).toHaveAttribute('aria-invalid', 'true');

      // Selecting both clears the field-level error; no stale custom validation result should keep
      // the group invalid.
      fireEvent.click(https);
      flush();
      flush();
      expect(http).not.toHaveAttribute('aria-invalid');
      expect(https).not.toHaveAttribute('aria-invalid');

      // Unticking one brings the real error back (not a phantom from a prior commit).
      fireEvent.click(http);
      flush();
      flush();
      expect(https).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears custom validity from disabled registered inputs when the group becomes valid', async () => {
      const [disabled, setDisabled] = createSignal(false);
      const [value, setValue] = createSignal<string[]>([]);
      const validate = (nextValue: unknown) =>
        (nextValue as string[]).length < 2 ? 'pick two' : null;

      render(() => (
        <Field.Root name="protocols" validationMode="onChange" validate={validate}>
          <CheckboxGroup value={value()} onValueChange={setValue}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" disabled={disabled()} />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      await userEvent.click(screen.getByTestId('cb-http'));
      flush();
      flush();

      const httpInput = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][value="http"]',
      );
      expect(httpInput?.validity.customError).toBe(true);

      setDisabled(true);
      flush();
      await userEvent.click(screen.getByTestId('cb-https'));
      flush();
      flush();

      expect(httpInput?.validity.customError).toBe(false);
    });

    it('prop: validationMode=onSubmit', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        if (v.length === 0) {
          return 'custom error 1';
        }
        if (v.length < 2) {
          return 'custom error 2';
        }
        if (v.includes('two')) {
          return 'custom error 3';
        }
        return null;
      });
      render(() => (
        <Form data-testid="form">
          <Field.Root validate={validateSpy} name="test">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="three" data-testid="checkbox" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));
      flush();

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await userEvent.click(checkbox2);
      flush();
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.submit(screen.getByTestId('form'));
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));

      await userEvent.click(checkbox1);
      flush();
      flush();
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));
      await userEvent.click(checkbox2);
      flush();
      flush();
      await userEvent.click(checkbox3);
      flush();
      flush();
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one', 'three']);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
    });

    it('prop: validationMode=onChange', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      flush();
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      fireEvent.click(checkbox2);
      flush();
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two']);

      fireEvent.click(checkbox1);
      flush();
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);

      fireEvent.click(checkbox3);
      flush();
      flush();
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('validates with the group value when toggling the parent checkbox', async () => {
      const validateSpy = vi.fn((_value: unknown) => null);

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="fruits">
          <CheckboxGroup allValues={['apple', 'orange']}>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="apple" />
            <Checkbox.Root value="orange" />
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const parent = screen.getByTestId('parent');

      await userEvent.click(parent);
      flush();
      flush();
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['apple', 'orange']);

      await userEvent.click(parent);
      flush();
      flush();
      expect(validateSpy).toHaveBeenCalledTimes(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);
    });

    it('revalidates when the controlled value changes externally', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const values = value as string[];
        return values.includes('one') ? 'error' : null;
      });
      const [selected, setSelected] = createSignal<string[]>([]);

      render(() => (
        <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
          <CheckboxGroup value={selected()}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const checkboxes = screen.getAllByTestId('checkbox');

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      const initialCallCount = validateSpy.mock.calls.length;

      setSelected(['one']);
      flush();
      flush();

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('prop: validationMode=onBlur', () => {
      const validateSpy = vi.fn((value: unknown) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(() => (
        <Field.Root validationMode="onBlur" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error data-testid="error" />
        </Field.Root>
      ));
      flush();

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, , checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(0);
      fireEvent.blur(checkbox1);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox3);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(1);
      fireEvent.blur(checkbox3);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three']);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(2);
      fireEvent.blur(checkbox1);
      flush();
      flush();
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three', 'one']);

      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });
  });

  describe('Field.Label', () => {
    // `expectedCount` is required: a set of unique ids is trivially unique when it is empty,
    // so a regression that drops every id would otherwise pass.
    function expectUniqueIds(expectedCount: number) {
      const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
      expect(ids).toHaveLength(expectedCount);
      expect(new Set(ids).size).toBe(ids.length);
    }

    [false, true].forEach((nativeButton) => {
      it(`keeps checkbox ids unique when the group shares one Field.Root (nativeButton=${nativeButton})`, async () => {
        render(() => (
          <Field.Root name="apples">
            <Field.Label>Apples</Field.Label>
            <CheckboxGroup allValues={['fuji', 'gala']}>
              <Checkbox.Root
                parent
                data-testid="parent"
                nativeButton={nativeButton}
                render={nativeButton ? (props) => <button {...props} /> : undefined}
              />
              <Checkbox.Root
                value="fuji"
                data-testid="fuji"
                nativeButton={nativeButton}
                render={nativeButton ? (props) => <button {...props} /> : undefined}
              />
              <Checkbox.Root
                value="gala"
                data-testid="gala"
                nativeButton={nativeButton}
                render={nativeButton ? (props) => <button {...props} /> : undefined}
              />
            </CheckboxGroup>
          </Field.Root>
        ));

        await waitFor(() => {
          expectUniqueIds(nativeButton ? 4 : 7);
        });
        // Queried without `hidden`, so the relationship has to reach the exposed checkboxes
        // rather than the hidden inputs behind them.
        await waitFor(() => {
          expect(screen.getByTestId('parent').getAttribute('aria-controls')!.split(' ')).toEqual([
            screen.getByTestId('fuji').id,
            screen.getByTestId('gala').id,
          ]);
        });
      });
    });

    [false, true].forEach((nativeButton) => {
      it(`keeps ids unique without allValues in a shared Field.Root (nativeButton=${nativeButton})`, async () => {
        render(() => (
          <Field.Root name="apples">
            <Field.Label>Apples</Field.Label>
            <CheckboxGroup>
              <Checkbox.Root
                value="fuji"
                nativeButton={nativeButton}
                render={nativeButton ? (props) => <button {...props} /> : undefined}
              />
              <Checkbox.Root
                value="gala"
                nativeButton={nativeButton}
                render={nativeButton ? (props) => <button {...props} /> : undefined}
              />
            </CheckboxGroup>
          </Field.Root>
        ));

        await waitFor(() => {
          expectUniqueIds(nativeButton ? 3 : 5);
        });
      });
    });

    it('labels the group rather than pointing Field.Label at one checkbox inside it', async () => {
      render(() => (
        <Field.Root name="apples">
          <Field.Label>Apples</Field.Label>
          <CheckboxGroup allValues={['fuji', 'gala']}>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="fuji" data-testid="fuji" />
            <Checkbox.Root value="gala" data-testid="gala" />
          </CheckboxGroup>
        </Field.Root>
      ));

      const label = screen.getByText('Apples');
      await waitFor(() => {
        expect(label).not.toHaveAttribute('for');
      });
      expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('gives each checkbox in a shared Field.Root its own accessible name', async () => {
      render(() => (
        <Field.Root name="apples">
          <CheckboxGroup allValues={['fuji', 'gala']}>
            <label>
              <Checkbox.Root parent data-testid="parent" />
              All
            </label>
            <label>
              <Checkbox.Root value="fuji" data-testid="fuji" />
              Fuji
            </label>
            <label>
              <Checkbox.Root value="gala" data-testid="gala" />
              Gala
            </label>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      for (const [index, name] of ['All', 'Fuji', 'Gala'].entries()) {
        const testId = ['parent', 'fuji', 'gala'][index];
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => {
          expect(screen.getByTestId(testId).getAttribute('aria-labelledby')).not.toBe(null);
        });
        const labelId = screen.getByTestId(testId).getAttribute('aria-labelledby')!;
        expect(document.getElementById(labelId)).toHaveTextContent(name);
      }
    });

    it('implicit association', async () => {
      const changeSpy = vi.fn();
      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="fuji-apple" />
                Fuji
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="gala-apple" />
                Gala
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="granny-smith-apple" onCheckedChange={changeSpy} />
                Granny Smith
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      for (const [index, checkbox] of checkboxes.entries()) {
        const label = labels[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => {
          expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
        });
      }

      fireEvent.click(labels[2]);
      flush();
      expect(changeSpy.mock.calls.length).toBe(1);
    });

    it('explicit association', async () => {
      const changeSpy = vi.fn();

      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Checkbox.Root value="fuji-apple" />
              <Field.Label data-testid="label">Fuji</Field.Label>
              <Field.Description data-testid="description">
                A fuji apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" onCheckedChange={changeSpy} />
              <Field.Label data-testid="label">Gala</Field.Label>
              <Field.Description data-testid="description">
                A gala apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const descriptions = screen.getAllByTestId('description');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      for (const [index, checkbox] of checkboxes.entries()) {
        const label = labels[index];
        const description = descriptions[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        // eslint-disable-next-line no-await-in-loop
        await waitFor(() => {
          expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
        });
        expect(description.getAttribute('id')).not.toBe(null);
        expect(description.getAttribute('id')).toBe(checkbox.getAttribute('aria-describedby'));
      }

      fireEvent.click(screen.getByText('Gala'));
      flush();
      expect(changeSpy.mock.calls.length).toBe(1);
    });
  });

  describe('Field.Description', () => {
    it('links the group and individual checkboxes', async () => {
      render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} aria-describedby="external-description">
            <Field.Description data-testid="group-description">
              Group description
            </Field.Description>
            <Field.Item>
              <Field.Label>
                <Checkbox.Root value="fuji-apple" aria-describedby="checkbox-description" />
                Fuji
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      flush();

      const groupDescription = screen.getByTestId('group-description');
      const groupDescriptionId = groupDescription.getAttribute('id');
      expect(groupDescriptionId).not.toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('group').getAttribute('aria-describedby')).toContain(
          groupDescriptionId,
        );
      });
      expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-describedby',
        `checkbox-description ${groupDescriptionId}`,
      );
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-describedby',
        `external-description ${groupDescriptionId}`,
      );
    });
  });

  describe('Form values', () => {
    it('projects selected enabled checkboxes while preserving the logical validation value', () => {
      const handleSubmit = vi.fn();
      const validateGroup = vi.fn((_value: unknown, _formValues: unknown) => null);
      const validateOther = vi.fn((_value: unknown, _formValues: unknown) => null);
      const [disabled, setDisabled] = createSignal(true);

      render(() => (
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="fruits" validate={validateGroup}>
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Checkbox.Root value="apple" />
              <Checkbox.Root value="banana" disabled={disabled()} />
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="other" validate={validateOther}>
            <Field.Control defaultValue="value" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple'],
        other: 'value',
      });
      expect((validateOther.mock.lastCall?.[1] as any).fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);

      setDisabled(false);
      flush();
      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect(validateGroup).toHaveBeenLastCalledWith(['apple', 'banana'], {
        fruits: ['apple', 'banana'],
        other: 'value',
      });
      expect((validateOther.mock.lastCall?.[1] as any).fruits).toEqual(['apple', 'banana']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple', 'banana']);
    });

    it('omits selected unmounted checkboxes while retaining group state across remounts', () => {
      const handleSubmit = vi.fn();
      const [mounted, setMounted] = createSignal(true);

      render(() => (
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Checkbox.Root value="apple" />
              <Show when={mounted()}>
                <Checkbox.Root value="banana" data-testid="banana" />
              </Show>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      setMounted(false);
      flush();
      fireEvent.submit(screen.getByTestId('form'));
      flush();
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      setMounted(true);
      flush();
      expect(screen.getByTestId('banana')).toHaveAttribute('aria-checked', 'true');

      fireEvent.submit(screen.getByTestId('form'));
      flush();
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple', 'banana'] });
    });

    it('preserves the logical field-name value when Checkbox.Root has no value prop', () => {
      const handleSubmit = vi.fn();

      render(() => (
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['fruits']}>
              <Checkbox.Root />
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['fruits'] });
    });

    it('omits selected checkboxes associated with another form', () => {
      const handleSubmit = vi.fn();

      render(() => (
        <div>
          <form id="external-form" />
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="fruits">
              <CheckboxGroup defaultValue={['apple', 'banana']}>
                <Checkbox.Root value="apple" />
                <Checkbox.Root value="banana" form="external-form" />
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        </div>
      ));
      flush();

      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });
    });

    it('omits checkboxes disabled by a fieldset', () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: unknown) => null);

      render(() => (
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="fruits">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Checkbox.Root value="apple" />
              <fieldset disabled>
                <Checkbox.Root value="banana" />
              </fieldset>
            </CheckboxGroup>
          </Field.Root>
          <Field.Root name="other" validate={validate}>
            <Field.Control defaultValue="value" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      fireEvent.submit(screen.getByTestId('form'));
      flush();

      expect((validate.mock.lastCall?.[1] as any).fruits).toEqual(['apple']);
      expect(handleSubmit.mock.lastCall?.[0].fruits).toEqual(['apple']);
    });
  });

  describe('Form', () => {
    it('includes the checkbox group value in form data', () => {
      render(() => (
        <Form data-testid="form">
          <Field.Root name="apple">
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).getAll('apple')).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('is validated as a group upon form submission', () => {
      const validateSpy = vi.fn();

      render(() => (
        <Form data-testid="form" onSubmit={(event: Event) => event.preventDefault()}>
          <Field.Root name="apple" validate={validateSpy}>
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      fireEvent.submit(screen.getByTestId('form'));
      flush();
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][0]).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('excludes parent checkboxes from form data', () => {
      const allValues = ['fuji-apple', 'gala-apple', 'granny-smith-apple'];
      const [value, setValue] = createSignal<string[]>(['fuji-apple', 'gala-apple']);

      render(() => (
        <Form data-testid="form">
          <Field.Root name="apple">
            <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
              <Field.Item>
                <Checkbox.Root parent data-testid="parent" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="granny" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      const parentCheckbox = screen.getByTestId('parent');
      expect(parentCheckbox).toHaveAttribute('aria-checked', 'mixed');

      fireEvent.click(screen.getByTestId('granny'));
      flush();

      expect(parentCheckbox).toHaveAttribute('aria-checked', 'true');

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).getAll('apple')).toEqual([
        'fuji-apple',
        'gala-apple',
        'granny-smith-apple',
      ]);
    });

    it('appends the id attribute of the error to aria-describedby of individual checkboxes', () => {
      render(() => (
        <Form errors={{ group: 'error' }}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" />
                <Field.Description>Description</Field.Description>
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));
      flush();

      const error = screen.getByTestId('error');
      expect(error).not.toBe(null);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(checkbox1.getAttribute('aria-describedby')).toContain(
        screen.getByText('Description').getAttribute('id'),
      );
    });
  });
});
