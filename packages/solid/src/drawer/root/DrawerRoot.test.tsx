import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';
import { useDrawerRootContext } from './DrawerRootContext';
import { REASONS } from '../../internals/reasons';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function TestDrawer(props: {
  rootProps?: Drawer.Root.Props | undefined;
  keepMounted?: boolean | undefined;
}): JSX.Element {
  return (
    <Drawer.Root {...(props.rootProps ?? {})}>
      <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
      <Drawer.Portal keepMounted={props.keepMounted}>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            <Drawer.Title>Title text</Drawer.Title>
            <Drawer.Description>Description text</Drawer.Description>
            <Drawer.Close data-testid="close">Close</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

describe.skipIf(!isJSDOM)('<Drawer.Root />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('opens on trigger click and closes on close press', async () => {
    render(() => <TestDrawer />);
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    const popup = screen.getByTestId('popup');
    expect(popup).toBeInTheDocument();
    expect(popup).toHaveAttribute('role', 'dialog');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-swipe-direction', 'down');
    expect(screen.getByTestId('viewport')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close'));
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('closes on Escape', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <TestDrawer rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
    ));
    await settle();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await settle();

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('reflects the swipeDirection prop in the popup state attribute', async () => {
    render(() => <TestDrawer rootProps={{ defaultOpen: true, swipeDirection: 'right' }} />);
    await settle();

    expect(screen.getByTestId('popup')).toHaveAttribute('data-swipe-direction', 'right');
  });

  it('supports detached triggers with handles', async () => {
    const handle = Drawer.createHandle<number>();

    render(() => (
      <div>
        <Drawer.Trigger handle={handle} payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root handle={handle}>
          {({ payload }: { payload: number | undefined }) => (
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <span data-testid="payload">{payload}</span>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          )}
        </Drawer.Root>
      </div>
    ));
    await settle();

    expect(screen.queryByTestId('payload')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 1' }));
    await settle();
    expect(screen.getByTestId('payload').textContent).toBe('1');

    fireEvent.click(screen.getByText('Close'));
    await settle();
    expect(screen.queryByTestId('payload')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 2' }));
    await settle();
    expect(screen.getByTestId('payload').textContent).toBe('2');
  });

  it('synchronizes trigger aria-controls with the popup id', async () => {
    render(() => <TestDrawer />);
    await settle();

    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    await settle();

    const popup = screen.getByTestId('popup');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  describe('snap points', () => {
    function SnapPointProbe(): JSX.Element {
      const { activeSnapPoint } = useDrawerRootContext();
      return <span data-testid="active-snap">{String(activeSnapPoint())}</span>;
    }

    function SnapPointControls(): JSX.Element {
      const { setActiveSnapPoint } = useDrawerRootContext();
      return (
        <>
          <button type="button" onClick={() => setActiveSnapPoint('100px')}>
            Set canceled snap point
          </button>
          <button type="button" onClick={() => setActiveSnapPoint(999)}>
            Set invalid snap point
          </button>
        </>
      );
    }

    it('resets the active snap point when closing', async () => {
      render(() => (
        <Drawer.Root defaultOpen snapPoints={['100px', '300px']} defaultSnapPoint="300px">
          <SnapPointProbe />
          <SnapPointControls />
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Close data-testid="close">Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      await settle();

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');

      fireEvent.click(screen.getByTestId('close'));
      await settle();

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
    });

    it('provides event details when the snap point changes on close', async () => {
      const handleSnapPointChange = vi.fn();
      render(() => (
        <Drawer.Root
          defaultOpen
          snapPoints={['100px', '300px']}
          onSnapPointChange={handleSnapPointChange}
        >
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Close data-testid="close">Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      await settle();

      fireEvent.click(screen.getByTestId('close'));
      await settle();

      expect(handleSnapPointChange).toHaveBeenCalled();
      const [, eventDetails] = handleSnapPointChange.mock.calls[0];
      expect(eventDetails.reason).toBe(REASONS.closePress);
    });

    it('honors canceled snap point changes and falls back from invalid uncontrolled values', async () => {
      const handleSnapPointChange = vi.fn(
        (nextSnapPoint: Drawer.Root.SnapPoint | null, eventDetails: any) => {
          if (nextSnapPoint === '100px') {
            eventDetails.cancel();
          }
        },
      );
      render(() => (
        <Drawer.Root
          defaultSnapPoint="300px"
          onSnapPointChange={handleSnapPointChange}
          snapPoints={['100px', '300px']}
        >
          <SnapPointProbe />
          <SnapPointControls />
        </Drawer.Root>
      ));
      await settle();

      expect(screen.getByTestId('active-snap').textContent).toBe('300px');

      fireEvent.click(screen.getByRole('button', { name: 'Set canceled snap point' }));
      await settle();
      expect(screen.getByTestId('active-snap').textContent).toBe('300px');

      fireEvent.click(screen.getByRole('button', { name: 'Set invalid snap point' }));
      await settle();
      expect(screen.getByTestId('active-snap').textContent).toBe('300px');
      expect(handleSnapPointChange).toHaveBeenLastCalledWith(
        999,
        expect.objectContaining({ reason: REASONS.none }),
      );
    });
  });

  it('throws a descriptive error when the root context is missing', () => {
    function MissingRootContextConsumer(): JSX.Element {
      useDrawerRootContext();
      return null;
    }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(() => <MissingRootContextConsumer />)).toThrow(
        'Base UI: DrawerRootContext is missing. Drawer parts must be placed within <Drawer.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
