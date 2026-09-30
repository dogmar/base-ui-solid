import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function pressAt(el: Element, x: number, y: number) {
  fireEvent.pointerDown(el, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

function moveTo(el: Element, x: number, y: number) {
  fireEvent.pointerMove(el, {
    buttons: 1,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

function releaseAt(el: Element, x: number, y: number) {
  fireEvent.pointerUp(el, {
    button: 0,
    buttons: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    pointerType: 'mouse',
    bubbles: true,
  });
}

function TestDrawer(props: {
  swipeAreaProps?: Drawer.SwipeArea.Props | undefined;
  rootProps?: Drawer.Root.Props | undefined;
}): JSX.Element {
  return (
    <Drawer.Root {...(props.rootProps ?? {})}>
      <Drawer.SwipeArea data-testid="swipe-area" {...(props.swipeAreaProps ?? {})} />
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

describe.skipIf(!isJSDOM)('<Drawer.SwipeArea />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders state attributes', async () => {
    render(() => <TestDrawer />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    expect(swipeArea).toHaveAttribute('role', 'presentation');
    expect(swipeArea).toHaveAttribute('aria-hidden', 'true');
    expect(swipeArea).toHaveAttribute('data-closed');
    // The default open direction is the opposite of the root's dismiss direction.
    expect(swipeArea).toHaveAttribute('data-swipe-direction', 'up');
  });

  it('opens the drawer when swiped in the open direction', async () => {
    render(() => <TestDrawer />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    expect(screen.queryByTestId('popup')).toBeNull();

    pressAt(swipeArea, 0, 300);
    moveTo(swipeArea, 0, 250);
    await settle();

    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('does not open when the swipe moves in the dismiss direction', async () => {
    render(() => <TestDrawer />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    pressAt(swipeArea, 0, 300);
    moveTo(swipeArea, 0, 350);
    releaseAt(swipeArea, 0, 350);
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('does not open the drawer when disabled', async () => {
    render(() => <TestDrawer swipeAreaProps={{ disabled: true }} />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    expect(swipeArea).toHaveAttribute('data-disabled');

    pressAt(swipeArea, 0, 300);
    moveTo(swipeArea, 0, 250);
    releaseAt(swipeArea, 0, 250);
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('respects custom swipeDirection', async () => {
    render(() => <TestDrawer swipeAreaProps={{ swipeDirection: 'right' }} />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    expect(swipeArea).toHaveAttribute('data-swipe-direction', 'right');

    pressAt(swipeArea, 0, 300);
    moveTo(swipeArea, 60, 300);
    await settle();

    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('reports the open change with the swipe reason and the swipe area as trigger', async () => {
    const handleOpenChange = vi.fn();
    render(() => <TestDrawer rootProps={{ onOpenChange: handleOpenChange }} />);
    await settle();

    const swipeArea = screen.getByTestId('swipe-area');
    pressAt(swipeArea, 0, 300);
    moveTo(swipeArea, 0, 250);
    await settle();

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe('swipe');
  });
});
