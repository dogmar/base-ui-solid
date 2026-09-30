import { createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Fieldset } from '../index';
import { Field } from '../../field';

describe('<Fieldset.Root />', () => {
  it('renders a fieldset element', () => {
    render(() => <Fieldset.Root data-testid="fieldset" />);
    expect(screen.getByTestId('fieldset').tagName).toBe('FIELDSET');
  });

  it('sets the native disabled attribute', () => {
    render(() => (
      <Fieldset.Root disabled data-testid="fieldset">
        <input />
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('fieldset')).toHaveAttribute('disabled');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies [data-disabled] when disabled', () => {
    render(() => <Fieldset.Root disabled data-testid="fieldset" />);
    expect(screen.getByTestId('fieldset')).toHaveAttribute('data-disabled', '');
  });

  it('disables Field roots within a disabled fieldset', () => {
    render(() => (
      <Fieldset.Root disabled>
        <Field.Root data-testid="root">
          <Field.Control data-testid="control" />
        </Field.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', '');
    expect(screen.getByTestId('control')).toBeDisabled();
  });

  it('keeps nested fieldsets disabled when an ancestor fieldset is disabled', () => {
    render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Root>
          <Field.Root>
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('control')).toHaveAttribute('disabled');
  });

  it('updates nested disabled precedence in both directions', () => {
    const [outerDisabled, setOuterDisabled] = createSignal(false);
    const [innerDisabled, setInnerDisabled] = createSignal(true);

    render(() => (
      <Fieldset.Root disabled={outerDisabled()}>
        <Fieldset.Root disabled={innerDisabled()}>
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
          </Field.Root>
        </Fieldset.Root>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');

    setOuterDisabled(true);
    setInnerDisabled(false);
    flush();
    expect(screen.getByTestId('control')).toBeDisabled();
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled');

    setOuterDisabled(false);
    flush();
    expect(screen.getByTestId('control')).not.toBeDisabled();
    expect(screen.getByTestId('root')).not.toHaveAttribute('data-disabled');
  });
});
