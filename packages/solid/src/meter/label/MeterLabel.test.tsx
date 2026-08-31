import { Show, createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Label />', () => {
  it('renders a span with role="presentation"', () => {
    render(() => (
      <Meter.Root value={50}>
        <Meter.Label data-testid="label">Battery level</Meter.Label>
      </Meter.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveAttribute('role', 'presentation');
  });

  it('updates and clears the meter label association', () => {
    const [labelId, setLabelId] = createSignal('label-a');
    const [showLabel, setShowLabel] = createSignal(true);

    render(() => (
      <Meter.Root value={50}>
        <Show when={showLabel()}>
          <Meter.Label id={labelId()}>Battery level</Meter.Label>
        </Show>
      </Meter.Root>
    ));

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-labelledby', 'label-a');

    setLabelId('label-b');
    flush();
    expect(meter).toHaveAttribute('aria-labelledby', 'label-b');

    setShowLabel(false);
    flush();
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Meter.Root>', () => {
    expect(() => render(() => <Meter.Label />)).toThrow(
      'Base UI: MeterRootContext is missing. Meter parts must be placed within <Meter.Root>.',
    );
  });
});
