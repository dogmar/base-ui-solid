import { Show, createSignal, flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Progress } from '..';

describe('<Progress.Label />', () => {
  it('renders a span with role="presentation"', () => {
    render(() => (
      <Progress.Root value={40}>
        <Progress.Label data-testid="label">Upload progress</Progress.Label>
      </Progress.Root>
    ));
    const label = screen.getByTestId('label');
    expect(label.tagName).toBe('SPAN');
    expect(label).toHaveAttribute('role', 'presentation');
  });

  it('updates and clears the progress bar label association', () => {
    const [labelId, setLabelId] = createSignal('label-a');
    const [showLabel, setShowLabel] = createSignal(true);

    render(() => (
      <Progress.Root value={40}>
        <Show when={showLabel()}>
          <Progress.Label id={labelId()}>Upload progress</Progress.Label>
        </Show>
      </Progress.Root>
    ));

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-a');

    setLabelId('label-b');
    flush();
    expect(progressbar).toHaveAttribute('aria-labelledby', 'label-b');

    setShowLabel(false);
    flush();
    expect(progressbar).not.toHaveAttribute('aria-labelledby');
  });

  it('throws a descriptive error when rendered outside <Progress.Root>', () => {
    expect(() => render(() => <Progress.Label />)).toThrow(
      'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
    );
  });
});
