import { render, screen } from '@solidjs/testing-library';
import { Progress } from '..';

describe('<Progress.Indicator />', () => {
  it('renders a div with the progress state attributes', () => {
    render(() => (
      <Progress.Root value={40}>
        <Progress.Indicator data-testid="indicator" />
      </Progress.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator.tagName).toBe('DIV');
    expect(indicator).toHaveAttribute('data-progressing');
  });

  describe('internal styles', () => {
    it('determinate', () => {
      render(() => (
        <Progress.Root value={33}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" render={(props) => <span {...props} />} />
          </Progress.Track>
        </Progress.Root>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(indicator.tagName).toBe('SPAN');
      expect(indicator.style.width).toBe('33%');
      expect(indicator.style.getPropertyValue('inset-inline-start')).toBe('0');
    });

    it('sets zero width when value is 0', () => {
      render(() => (
        <Progress.Root value={0}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(indicator.style.width).toBe('0%');
    });

    it('indeterminate', () => {
      render(() => (
        <Progress.Root value={null}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>
      ));

      const indicator = screen.getByTestId('indicator');
      expect(indicator.style.width).toBe('');
      expect(indicator).toHaveAttribute('data-indeterminate');
    });
  });
});
