import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Field } from '../index';

describe('<Field.Description />', () => {
  it('renders a p element', () => {
    render(() => (
      <Field.Root>
        <Field.Description data-testid="description">Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByTestId('description').tagName).toBe('P');
  });

  it('should set aria-describedby on the control automatically', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    flush();
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('should preserve user aria-describedby values on the control', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    flush();
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
      `external-description ${screen.getByText('Message').id}`,
    );
  });

  it('does not register an empty description id', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description id="">Message</Field.Description>
      </Field.Root>
    ));

    flush();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'external-description');
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('description')).toHaveAttribute('data-disabled');
  });
});
