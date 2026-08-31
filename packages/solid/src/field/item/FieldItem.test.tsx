import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Field } from '../index';

describe('<Field.Item />', () => {
  it('renders a div', () => {
    render(() => (
      <Field.Root>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(screen.getByTestId('item').tagName).toBe('DIV');
  });

  it('applies [data-disabled] when disabled', () => {
    render(() => (
      <Field.Root>
        <Field.Item data-testid="item" disabled />
      </Field.Root>
    ));

    expect(screen.getByTestId('item')).toHaveAttribute('data-disabled', '');
  });

  it('inherits the disabled state from Field.Root', () => {
    render(() => (
      <Field.Root disabled>
        <Field.Item data-testid="item" />
      </Field.Root>
    ));

    expect(screen.getByTestId('item')).toHaveAttribute('data-disabled', '');
  });

  it('propagates its disabled state to nested label and description', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Label data-testid="label">Label</Field.Label>
          <Field.Description data-testid="description">Description</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('label')).toHaveAttribute('data-disabled', '');
    expect(screen.getByTestId('description')).toHaveAttribute('data-disabled', '');
  });

  it('scopes label association to controls within the item', () => {
    render(() => (
      <Field.Root>
        <Field.Control id="outer-control" />
        <Field.Item>
          <Field.Label data-testid="item-label">Item label</Field.Label>
        </Field.Item>
      </Field.Root>
    ));

    flush();
    // The item has its own labelable scope, so its label must not adopt the
    // outer control's id.
    expect(screen.getByTestId('item-label')).not.toHaveAttribute('for', 'outer-control');
  });
});
