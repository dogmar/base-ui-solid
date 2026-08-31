import { createSignal, flush, Show } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Field } from '../index';

describe('<Field.Label />', () => {
  it('renders a label element', () => {
    render(() => (
      <Field.Root>
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    expect(screen.getByTestId('label').tagName).toBe('LABEL');
  });

  it('should set htmlFor (rendered as `for`) referencing the control automatically', () => {
    render(() => (
      <Field.Root data-testid="field">
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    flush();
    expect(screen.getByTestId('label')).toHaveAttribute('for', screen.getByRole('textbox').id);
  });

  it('uses an explicit control id in `for`', () => {
    render(() => (
      <Field.Root>
        <Field.Control id="explicit-id" />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    flush();
    expect(screen.getByTestId('label')).toHaveAttribute('for', 'explicit-id');
  });

  it('when nativeLabel={false}, clicking focuses the associated control', async () => {
    render(() => (
      <Field.Root>
        <Field.Control data-testid="control" />
        <Field.Label nativeLabel={false} render={(props) => <div {...props} />} data-testid="label">
          Label
        </Field.Label>
      </Field.Root>
    ));

    flush();
    const label = screen.getByTestId('label');
    const control = screen.getByTestId('control');

    expect(label).not.toHaveAttribute('for');

    await userEvent.click(label);
    flush();
    expect(control).toHaveFocus();
  });

  describe('control selection', () => {
    it('keeps the selected control id when another control unmounts', () => {
      const [second, setSecond] = createSignal(true);

      render(() => (
        <Field.Root>
          <Field.Control id="a" />
          <Show when={second()}>
            <Field.Control id="b" />
          </Show>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Root>
      ));

      flush();
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      setSecond(false);
      flush();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');
    });

    it('falls over to the remaining control when the selected one unmounts', () => {
      const [first, setFirst] = createSignal(true);

      render(() => (
        <Field.Root>
          <Show when={first()}>
            <Field.Control id="a" />
          </Show>
          <Field.Control id="b" />
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Root>
      ));

      flush();
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'a');

      setFirst(false);
      flush();

      expect(screen.getByTestId('label')).toHaveAttribute('for', 'b');
    });
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled');
  });

  it('prevents text selection on double click', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Label data-testid="label">Label</Field.Label>
      </Field.Root>
    ));

    const label = screen.getByTestId('label');
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 });
    label.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  describe('dev warnings', () => {
    it('does not warn by default', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Label>Label</Field.Label>
        </Field.Root>
      ));
      flush();

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('errors if nativeLabel=true but the element is not a label', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <Field.Root>
            <Field.Control />
            <Field.Label nativeLabel render={(props) => <div {...props} />}>
              Label
            </Field.Label>
          </Field.Root>
        ));
        flush();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.lastCall?.[0]).toContain(
          '<Field.Label> expected a <label> element because the `nativeLabel` prop is true.',
        );
      } finally {
        errorSpy.mockRestore();
      }
    });

    it('errors if nativeLabel=false but the element is a label', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <Field.Root>
            <Field.Control />
            <Field.Label nativeLabel={false}>Label</Field.Label>
          </Field.Root>
        ));
        flush();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.lastCall?.[0]).toContain(
          '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false.',
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});
