import { expect } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Tabs } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

// The React suite covers positioning extensively in Chromium-only tests
// (`describe.skipIf(isJSDOM)('rendering')`) because jsdom cannot measure
// layout; those suites are intentionally not ported. The pre-hydration script
// suites do not apply to the Solid port at all.
describe('<Tabs.Indicator />', () => {
  it('exposes null active tab state when the selected value has no matching tab', async () => {
    let capturedState: Tabs.Indicator.State | undefined;

    render(() => (
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator
            render={(props, state) => {
              capturedState = state;
              return <span data-testid="bubble" {...props} />;
            }}
          />
        </Tabs.List>
      </Tabs.Root>
    ));
    await settle();

    expect(capturedState).not.toBe(undefined);
    expect(capturedState!.activeTabPosition).toBe(null);
    expect(capturedState!.activeTabSize).toBe(null);
    expect(screen.getByTestId('bubble')).toHaveAttribute('hidden');
  });

  it('does not render when the root value is null', async () => {
    const { container } = render(() => (
      <Tabs.Root value={null}>
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator data-testid="indicator" />
        </Tabs.List>
      </Tabs.Root>
    ));
    await settle();

    expect(screen.queryByTestId('indicator')).toBe(null);
    expect(container.querySelector('span')).toBe(null);
  });

  it('sets the active tab CSS variables when a tab is selected', async () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Tab value="two">Two</Tabs.Tab>
          <Tabs.Indicator data-testid="indicator" />
        </Tabs.List>
      </Tabs.Root>
    ));
    await settle();

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('role', 'presentation');
    // jsdom reports zero dimensions; the variables are still published.
    expect(indicator.style.getPropertyValue('--active-tab-left')).toBe('0px');
    expect(indicator.style.getPropertyValue('--active-tab-width')).toBe('0px');
    expect(indicator.style.getPropertyValue('--active-tab-height')).toBe('0px');
    // With zero measured dimensions the indicator stays hidden.
    expect(indicator).toHaveAttribute('hidden');
  });

  it('sets tabs state data attributes', async () => {
    render(() => (
      <Tabs.Root defaultValue="one" orientation="vertical">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator data-testid="indicator" />
        </Tabs.List>
      </Tabs.Root>
    ));
    await settle();

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-orientation', 'vertical');
    expect(indicator).toHaveAttribute('data-activation-direction', 'none');
  });
});
