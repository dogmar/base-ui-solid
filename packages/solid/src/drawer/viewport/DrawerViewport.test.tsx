import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';
import { REASONS } from '../../internals/reasons';

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

describe.skipIf(!isJSDOM)('<Drawer.Viewport />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders as a presentation container for the popup', async () => {
    render(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup" />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    expect(viewport).toHaveAttribute('role', 'presentation');
    expect(viewport).toHaveAttribute('data-open');
    // The drawer viewport suppresses the generic nested dialog attribute.
    expect(viewport).not.toHaveAttribute('data-nested-dialog-open');
  });

  it('dismisses the drawer with a mouse swipe past the threshold', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer content</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;
    try {
      pressAt(viewport, 0, 0);
      moveTo(viewport, 0, 1);
      moveTo(viewport, 0, 120);
      releaseAt(viewport, 0, 120);
      await settle();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][0]).toBe(false);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.swipe);
    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('does not dismiss on a swipe below the threshold', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer content</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;
    try {
      pressAt(viewport, 0, 0);
      moveTo(viewport, 0, 1);
      moveTo(viewport, 0, 6);
      releaseAt(viewport, 0, 6);
      await settle();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('does not start swipes from elements marked with data-base-ui-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <div data-base-ui-swipe-ignore data-testid="ignored">
                Ignored region
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    const ignored = screen.getByTestId('ignored');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => ignored;
    try {
      pressAt(viewport, 0, 0);
      moveTo(viewport, 0, 1);
      moveTo(viewport, 0, 120);
      releaseAt(viewport, 0, 120);
      await settle();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not start pointer swipes from within Drawer.Content', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content data-testid="content">Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    const content = screen.getByTestId('content');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => content;
    try {
      pressAt(viewport, 0, 0);
      moveTo(viewport, 0, 1);
      moveTo(viewport, 0, 120);
      releaseAt(viewport, 0, 120);
      await settle();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).not.toHaveBeenCalled();
  });
});
