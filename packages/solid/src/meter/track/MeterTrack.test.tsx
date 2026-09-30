import { render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Track />', () => {
  it('renders a div and forwards props', () => {
    render(() => (
      <Meter.Root value={30}>
        <Meter.Track data-testid="track" id="my-track">
          <Meter.Indicator />
        </Meter.Track>
      </Meter.Root>
    ));
    const track = screen.getByTestId('track');
    expect(track.tagName).toBe('DIV');
    expect(track).toHaveAttribute('id', 'my-track');
  });

  it('supports the render prop', () => {
    render(() => (
      <Meter.Root value={30}>
        <Meter.Track data-testid="track" render={(props) => <span {...props} />} />
      </Meter.Root>
    ));
    expect(screen.getByTestId('track').tagName).toBe('SPAN');
  });
});
