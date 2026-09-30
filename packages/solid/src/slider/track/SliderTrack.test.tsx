import { expect } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Slider } from '../index';

// The React suite only runs the shared conformance tests for this part; a
// smoke test covers the equivalent rendering behavior in the Solid port.

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe('<Slider.Track />', () => {
  it('renders a div with relative positioning and state attributes', async () => {
    render(() => (
      <Slider.Root defaultValue={30}>
        <Slider.Control>
          <Slider.Track data-testid="track">
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const track = screen.getByTestId('track');
    expect(track.tagName).toBe('DIV');
    expect(track.style.position).toBe('relative');
    expect(track).toHaveAttribute('data-orientation', 'horizontal');
  });
});
