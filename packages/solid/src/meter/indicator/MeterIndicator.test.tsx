import { render, screen } from '@solidjs/testing-library';
import { Meter } from '..';

describe('<Meter.Indicator />', () => {
  it('renders a div', () => {
    render(() => (
      <Meter.Root value={30}>
        <Meter.Indicator data-testid="indicator" />
      </Meter.Root>
    ));
    expect(screen.getByTestId('indicator').tagName).toBe('DIV');
  });

  describe('value bounds', () => {
    it('clamps the width to 100% when the value exceeds max', () => {
      render(() => (
        <Meter.Root value={150}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('100%');
    });

    it('clamps the width to 0% when the value is below min', () => {
      render(() => (
        <Meter.Root value={-10}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('0%');
    });

    it('produces a finite width when min equals max', () => {
      render(() => (
        <Meter.Root value={5} min={5} max={5}>
          <Meter.Track>
            <Meter.Indicator data-testid="indicator" />
          </Meter.Track>
        </Meter.Root>
      ));

      expect(screen.getByTestId('indicator').style.width).toBe('0%');
    });
  });

  it('merges a user-provided style with the internal positioning styles', () => {
    render(() => (
      <Meter.Root value={33}>
        <Meter.Track>
          <Meter.Indicator data-testid="indicator" style={{ 'background-color': 'red' }} />
        </Meter.Track>
      </Meter.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.width).toBe('33%');
    expect(indicator.style.backgroundColor).toBe('red');
  });
});
