import { createSignal, flush } from 'solid-js';
import { Show } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
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

describe('<Collapsible.Root />', () => {
  describe('ARIA attributes', () => {
    it('sets ARIA attributes', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-expanded');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel id="custom-panel-id" data-testid="panel" />
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });

    it('unregisters and restores the generated panel id when the panel remounts', async () => {
      const [panelMounted, setPanelMounted] = createSignal(true);

      render(() => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Show when={panelMounted()}>
            <Collapsible.Panel data-testid="panel" />
          </Show>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-controls');

      setPanelMounted(false);
      await settle();
      expect(trigger).not.toHaveAttribute('aria-controls');

      setPanelMounted(true);
      await settle();
      expect(trigger).toHaveAttribute('aria-controls', screen.getByTestId('panel').id);
    });
  });

  describe('collapsible status', () => {
    it('disabled status', async () => {
      render(() => (
        <Collapsible.Root disabled>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('data-disabled');
    });

    it('does not toggle or call onOpenChange when clicked while disabled', async () => {
      const handleOpenChange = vi.fn();

      render(() => (
        <Collapsible.Root disabled onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await userEvent.click(trigger);
      await settle();

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('BaseUIChangeEventDetails', () => {
    it('calls onOpenChange with eventDetails', async () => {
      const handleOpenChange = vi.fn();

      render(() => (
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.click(trigger);
      await settle();

      expect(handleOpenChange.mock.calls.length).toBe(1);
      const [openArg, details] = handleOpenChange.mock.calls[0] as [boolean, any];
      expect(openArg).toBe(true);
      expect(details).not.toBe(undefined);
      expect(details.reason).toBe(REASONS.triggerPress);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.isCanceled).toBe(false);
      expect(typeof details.cancel).toBe('function');
      expect(typeof details.allowPropagation).toBe('function');
    });

    it('eventDetails.cancel() prevents opening while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      render(() => (
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.click(trigger);
      await settle();

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('eventDetails.cancel() prevents closing while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen: boolean, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      render(() => (
        <Collapsible.Root defaultOpen onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.click(trigger);
      await settle();

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
    });
  });

  describe('open state', () => {
    it('controlled trigger presses request open and close state changes', async () => {
      function App() {
        const [open, setOpen] = createSignal(false);
        return (
          <Collapsible.Root open={open()} onOpenChange={setOpen}>
            <Collapsible.Trigger>trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      }

      render(() => <App />);
      await settle();

      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      });
    });

    it('does not change controlled open state without an external update', async () => {
      const handleOpenChange = vi.fn();

      render(() => (
        <Collapsible.Root open={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'trigger' });

      await userEvent.click(trigger);
      await settle();

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('controlled mode', async () => {
      const [open, setOpen] = createSignal(false);

      render(() => (
        <div>
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger>trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
          <button type="button" onClick={() => setOpen(!open())}>
            toggle
          </button>
        </div>
      ));
      await settle();

      const externalTrigger = screen.getByRole('button', { name: 'toggle' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await userEvent.click(externalTrigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');

      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await userEvent.click(externalTrigger);
      await settle();

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      });
    });

    it('uncontrolled mode', async () => {
      render(() => (
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger />
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-panel-open');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      });
    });
  });

  describe('state callbacks', () => {
    it('passes state to className and style callbacks', async () => {
      render(() => (
        <Collapsible.Root
          data-testid="root"
          className={(state) => (state.open ? 'root-open' : 'root-closed')}
          style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
        >
          <Collapsible.Trigger
            className={(state) => (state.open ? 'trigger-open' : 'trigger-closed')}
            style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            Trigger
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            data-testid="panel"
            className={(state) => (state.open ? 'panel-open' : 'panel-closed')}
            style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(root).toHaveClass('root-closed');
      expect(root).toHaveStyle({ opacity: '0.5' });
      expect(trigger).toHaveClass('trigger-closed');
      expect(trigger).toHaveStyle({ opacity: '0.5' });
      expect(panel).toHaveClass('panel-closed');
      expect(panel).toHaveStyle({ opacity: '0.5' });

      await userEvent.click(trigger);
      await settle();

      expect(root).toHaveClass('root-open');
      expect(root).toHaveStyle({ opacity: '1' });
      expect(trigger).toHaveClass('trigger-open');
      expect(trigger).toHaveStyle({ opacity: '1' });
      expect(panel).toHaveClass('panel-open');
      expect(panel).toHaveStyle({ opacity: '1' });
    });
  });
});
