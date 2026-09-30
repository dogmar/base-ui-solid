import { expect } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Slider } from '../index';

// The React suite covers keyboard/indicator parity for edge-aligned sliders
// in Chromium-only tests (`it.skipIf(isJSDOM)`), since jsdom cannot measure
// layout. Center-aligned indicator styles are computed purely from values, so
// those are asserted here instead.

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Slider.Indicator />', () => {
  it('sizes the indicator from the value for single-value sliders', async () => {
    render(() => (
      <Slider.Root defaultValue={30}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.width).toBe('30%');
    expect(indicator.style.insetInlineStart).toBe('0');
    expect(indicator.style.position).toBe('relative');
  });

  it('positions the indicator between both values for range sliders', async () => {
    render(() => (
      <Slider.Root defaultValue={[30, 70]}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb index={0} />
            <Slider.Thumb index={1} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.insetInlineStart).toBe('30%');
    expect(indicator.style.width).toBe('40%');
  });

  it('uses bottom/height for vertical sliders', async () => {
    render(() => (
      <Slider.Root defaultValue={30} orientation="vertical">
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const indicator = screen.getByTestId('indicator');
    expect(indicator.style.height).toBe('30%');
    expect(indicator.style.position).toBe('absolute');
    expect(indicator.style.width).toBe('inherit');
  });
});
