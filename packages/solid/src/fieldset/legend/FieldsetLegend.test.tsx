import { createSignal, flush, Show } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Fieldset } from '../index';

describe('<Fieldset.Legend />', () => {
  it('renders a div element', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('legend').tagName).toBe('DIV');
  });

  it('should set aria-labelledby on the fieldset automatically', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    flush();
    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('legend').id,
    );
  });

  it('should set aria-labelledby on the fieldset with custom id', () => {
    render(() => (
      <Fieldset.Root>
        <Fieldset.Legend id="legend-id" />
      </Fieldset.Root>
    ));

    flush();
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-id');
  });

  it('updates and clears the legend association', () => {
    const [legendId, setLegendId] = createSignal('legend-a');
    const [showLegend, setShowLegend] = createSignal(true);

    render(() => (
      <Fieldset.Root>
        <Show when={showLegend()}>
          <Fieldset.Legend id={legendId()}>Legend</Fieldset.Legend>
        </Show>
      </Fieldset.Root>
    ));

    flush();
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-a');

    setLegendId('legend-b');
    flush();
    expect(screen.getByRole('group')).toHaveAttribute('aria-labelledby', 'legend-b');

    setShowLegend(false);
    flush();
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-labelledby');
  });

  it('applies [data-disabled] when the fieldset is disabled', () => {
    render(() => (
      <Fieldset.Root disabled>
        <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
      </Fieldset.Root>
    ));

    expect(screen.getByTestId('legend')).toHaveAttribute('data-disabled', '');
  });

  it('throws a descriptive error when rendered outside <Fieldset.Root>', () => {
    expect(() => render(() => <Fieldset.Legend />)).toThrow(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  });
});
