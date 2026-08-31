import { flush } from 'solid-js';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { Field } from '../index';

describe('<Field.Error />', () => {
  it('should set aria-describedby on the control automatically', () => {
    render(() => (
      <Field.Root invalid>
        <Field.Control />
        <Field.Error match>Message</Field.Error>
      </Field.Root>
    ));

    flush();
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('does not render while the field is valid', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Error data-testid="error">Message</Field.Error>
      </Field.Root>
    ));

    expect(screen.queryByTestId('error')).toBe(null);
  });

  it('shows the validation error once validation fails', () => {
    render(() => (
      <Field.Root validationMode="onChange" validate={() => 'custom error message'}>
        <Field.Control />
        <Field.Error data-testid="error" />
      </Field.Root>
    ));

    expect(screen.queryByTestId('error')).toBe(null);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();
    flush();

    expect(screen.getByTestId('error')).toHaveTextContent('custom error message');
  });

  describe('prop: match', () => {
    it('renders unconditionally when `match` is true', () => {
      render(() => (
        <Field.Root>
          <Field.Control />
          <Field.Error data-testid="error" match>
            Message
          </Field.Error>
        </Field.Root>
      ));

      expect(screen.getByTestId('error')).toHaveTextContent('Message');
    });

    it('only renders when `match` matches constraint validation', async () => {
      render(() => (
        <Field.Root validationMode="onBlur">
          <Field.Control required minlength={2} />
          <Field.Error match="valueMissing">Message</Field.Error>
        </Field.Root>
      ));

      const input = screen.getByRole('textbox') as HTMLInputElement;

      expect(screen.queryByText('Message')).toBe(null);

      // Dirty the field and clear it so `valueMissing` counts.
      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: 'a' } });
      fireEvent.input(input, { target: { value: '' } });
      fireEvent.blur(input);
      flush();

      expect(screen.queryByText('Message')).not.toBe(null);

      fireEvent.focus(input);
      fireEvent.input(input, { target: { value: 'a' } });
      flush();

      // Unmounting waits for the (absent) exit animation to complete, which
      // resolves on a later microtask in jsdom.
      await waitFor(() => {
        expect(screen.queryByText('Message')).toBe(null);
      });
    });

    it('shows custom errors with match="customError"', () => {
      render(() => (
        <Field.Root validationMode="onChange" validate={() => 'error'}>
          <Field.Control />
          <Field.Error match="customError">Message</Field.Error>
        </Field.Root>
      ));

      expect(screen.queryByText('Message')).toBe(null);

      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
      flush();

      expect(screen.queryByText('Message')).not.toBe(null);
    });

    it('does not render for a non-matching validity key', () => {
      render(() => (
        <Field.Root validationMode="onChange" validate={() => 'error'}>
          <Field.Control />
          <Field.Error match="typeMismatch">Message</Field.Error>
        </Field.Root>
      ));

      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
      flush();

      expect(screen.queryByText('Message')).toBe(null);
    });
  });

  it('does not render when the field is disabled', () => {
    render(() => (
      <Field.Root disabled validationMode="onChange" validate={() => 'error'}>
        <Field.Control />
        <Field.Error data-testid="error">Message</Field.Error>
      </Field.Root>
    ));

    expect(screen.queryByTestId('error')).toBe(null);
  });

  it('renders multiple validation errors as a list', () => {
    render(() => (
      <Field.Root validationMode="onChange" validate={() => ['first error', 'second error']}>
        <Field.Control />
        <Field.Error data-testid="error" />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    const error = screen.getByTestId('error');
    const list = error.querySelector('ul');
    expect(list).not.toBe(null);
    expect(list?.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('first error')).not.toBe(null);
    expect(screen.getByText('second error')).not.toBe(null);
  });

  it('renders a single validation error as text', () => {
    render(() => (
      <Field.Root validationMode="onChange" validate={() => ['only error']}>
        <Field.Control />
        <Field.Error data-testid="error" />
      </Field.Root>
    ));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'a' } });
    flush();

    const error = screen.getByTestId('error');
    expect(error.querySelector('ul')).toBe(null);
    expect(error).toHaveTextContent('only error');
  });

  it('renders custom children instead of the error message', () => {
    render(() => (
      <Field.Root invalid>
        <Field.Error data-testid="error" match>
          Custom children
        </Field.Error>
      </Field.Root>
    ));

    expect(screen.getByTestId('error')).toHaveTextContent('Custom children');
  });

  it('removes the error and its aria-describedby link when the field becomes valid again', async () => {
    render(() => (
      <Field.Root validationMode="onChange" validate={(value) => (value === 'bad' ? 'error' : null)}>
        <Field.Control />
        <Field.Error data-testid="error" />
      </Field.Root>
    ));

    const input = screen.getByRole('textbox');

    fireEvent.input(input, { target: { value: 'bad' } });
    flush();
    expect(screen.getByTestId('error')).toHaveTextContent('error');
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-describedby', screen.getByTestId('error').id);
    });

    fireEvent.input(input, { target: { value: 'good' } });
    flush();
    await waitFor(() => {
      expect(screen.queryByTestId('error')).toBe(null);
    });
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('updates the displayed message while the error stays mounted', async () => {
    render(() => (
      <Field.Root
        validationMode="onChange"
        validate={(value) => (value === 'a' ? 'error A' : 'error B')}
      >
        <Field.Control />
        <Field.Error data-testid="error" />
      </Field.Root>
    ));

    const input = screen.getByRole('textbox');

    fireEvent.input(input, { target: { value: 'a' } });
    flush();
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('error A');
    });

    fireEvent.input(input, { target: { value: 'b' } });
    flush();
    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('error B');
    });
  });
});
