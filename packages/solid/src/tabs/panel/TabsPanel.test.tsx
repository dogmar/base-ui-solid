import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
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

describe('<Tabs.Panel />', () => {
  it('throws a descriptive error when rendered outside <Tabs.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Tabs.Panel value="1" keepMounted />)).toThrow(
        'Base UI: TabsRootContext is missing. Tabs parts must be placed within <Tabs.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('panels sharing a value', () => {
    it('keeps the surviving registration when a shadowed panel unmounts', async () => {
      const [shadowedMounted, setShadowedMounted] = createSignal(true);

      render(() => (
        <Tabs.Root value="a">
          <Tabs.List>
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
          </Tabs.List>
          <Show when={shadowedMounted()}>
            <Tabs.Panel value="b" keepMounted data-testid="shadowed" />
          </Show>
          <Tabs.Panel value="b" keepMounted data-testid="owner" />
        </Tabs.Root>
      ));
      await settle();

      const tabB = screen.getAllByRole('tab')[1];
      const owner = screen.getByTestId('owner');

      // The last panel to register owns the value.
      expect(tabB).toHaveAttribute('aria-controls', owner.id);

      setShadowedMounted(false);
      await settle();

      expect(screen.queryByTestId('shadowed')).toBe(null);
      expect(tabB).toHaveAttribute('aria-controls', owner.id);
    });
  });

  it('sets the panel index data attribute', async () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one" />
        </Tabs.List>
        <Tabs.Panel value="one" data-testid="panel" />
      </Tabs.Root>
    ));
    await settle();

    expect(screen.getByTestId('panel')).toHaveAttribute('data-index', '0');
  });

  describe('prop: keepMounted', () => {
    it('does not render an inactive panel when keepMounted is false', async () => {
      render(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="one" data-testid="panel-one">
            Panel one
          </Tabs.Panel>
          <Tabs.Panel value="two" data-testid="panel-two">
            Panel two
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByTestId('panel-one')).not.toBe(null);
      expect(screen.queryByTestId('panel-two')).toBe(null);

      await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
      await settle();

      await waitFor(() => {
        expect(screen.queryByTestId('panel-two')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.queryByTestId('panel-one')).toBe(null);
      });
    });

    it('keeps an inactive panel mounted and hidden when keepMounted is true', async () => {
      render(() => (
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="one" keepMounted data-testid="panel-one">
            Panel one
          </Tabs.Panel>
          <Tabs.Panel value="two" keepMounted data-testid="panel-two">
            Panel two
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      const panelOne = screen.getByTestId('panel-one');
      const panelTwo = screen.getByTestId('panel-two');

      expect(panelOne).not.toHaveAttribute('hidden');
      expect(panelOne).toHaveAttribute('tabindex', '0');
      expect(panelTwo).toHaveAttribute('hidden');
      expect(panelTwo).toHaveAttribute('data-hidden');
      expect(panelTwo).toHaveAttribute('inert');
      expect(panelTwo).toHaveAttribute('tabindex', '-1');

      await userEvent.click(screen.getByRole('tab', { name: 'Two' }));
      await settle();

      await waitFor(() => {
        expect(panelOne).toHaveAttribute('hidden');
      });
      expect(panelTwo).not.toHaveAttribute('hidden');
      expect(panelTwo).not.toHaveAttribute('inert');
      expect(panelTwo).toHaveAttribute('tabindex', '0');
    });
  });

  it('has role=tabpanel and is labelled by its tab', async () => {
    render(() => (
      <Tabs.Root defaultValue="one">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="one" data-testid="panel">
          Panel one
        </Tabs.Panel>
      </Tabs.Root>
    ));
    await settle();

    const panel = screen.getByTestId('panel');
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', screen.getByRole('tab').id);
  });
});
