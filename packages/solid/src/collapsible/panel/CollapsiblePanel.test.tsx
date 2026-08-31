import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { reset as resetLogs } from '@base-ui/utils/warn';
import { Collapsible } from '..';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function fireBeforeMatch(element: Element) {
  fireEvent(
    element,
    new window.Event('beforematch', {
      bubbles: true,
      cancelable: false,
    }),
  );
}

describe('<Collapsible.Panel />', () => {
  beforeEach(() => {
    resetLogs();
  });

  it('warns when hiddenUntilFound overrides keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <Collapsible.Root>
          <Collapsible.Panel hiddenUntilFound keepMounted={false}>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('prop: keepMounted', () => {
    it('does not unmount the panel when true', async () => {
      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Collapsible.Root open={open()} onOpenChange={setOpen}>
            <Collapsible.Trigger />
            <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      }

      render(() => <App />);
      await settle();

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.queryByText(PANEL_CONTENT)?.getAttribute('id'),
      );
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.getAttribute('aria-controls')).toBe(null);
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      });
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');
    });
  });

  describe('prop: hiddenUntilFound', () => {
    it('uses `hidden="until-found"` to hide panel when true', async () => {
      render(() => (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const panel = screen.getByText(PANEL_CONTENT);

      expect(panel.getAttribute('hidden')).toBe('until-found');
    });

    it('opens when a beforematch event fires on the panel', async () => {
      const handleOpenChange = vi.fn();

      render(() => (
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const panel = screen.getByText(PANEL_CONTENT);

      fireBeforeMatch(panel);
      await settle();

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.none);
      expect(panel).toHaveAttribute('data-open');
    });

    it('does not open when the beforematch open is canceled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          if (eventDetails.reason === REASONS.none) {
            eventDetails.cancel();
          }
        },
      );

      render(() => (
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByText(PANEL_CONTENT);

      fireBeforeMatch(panel);
      await settle();

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');
    });
  });

  describe('prop: id', () => {
    it('applies the custom id to the panel element', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Panel id="custom-id" data-testid="panel" />
        </Collapsible.Root>
      ));
      await settle();

      expect(screen.getByTestId('panel')).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('state callbacks', () => {
    it('exposes transitionStatus in the panel state', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Panel
            data-testid="panel"
            className={(state) => `status-${state.transitionStatus ?? 'none'}`}
          />
        </Collapsible.Root>
      ));
      await settle();

      const panel = screen.getByTestId('panel');
      // With `enableIdleState`, an initially open panel reports `idle`.
      expect(panel.className).toContain('status-idle');
    });
  });
});
