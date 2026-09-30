import { render, screen } from '@solidjs/testing-library';
import { Progress } from '..';

describe('<Progress.Track />', () => {
  it('renders a div with the progress state attributes and forwards props', () => {
    render(() => (
      <Progress.Root value={40}>
        <Progress.Track data-testid="track" id="my-track" />
      </Progress.Root>
    ));
    const track = screen.getByTestId('track');
    expect(track.tagName).toBe('DIV');
    expect(track).toHaveAttribute('id', 'my-track');
    expect(track).toHaveAttribute('data-progressing');
  });

  it('supports the render prop', () => {
    render(() => (
      <Progress.Root value={40}>
        <Progress.Track data-testid="track" render={(props) => <span {...props} />} />
      </Progress.Root>
    ));
    expect(screen.getByTestId('track').tagName).toBe('SPAN');
  });
});
