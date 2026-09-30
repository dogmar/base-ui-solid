import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { AlertDialog } from '..';
import { REASONS } from '../../internals/reasons';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function outsideMousePress(target: Element) {
  fireEvent.pointerDown(target, { pointerType: 'mouse' });
  fireEvent.mouseDown(target);
  fireEvent.mouseUp(target);
  fireEvent.click(target, { detail: 1 });
}

function getInternalBackdrop(): Element | null {
  return document.querySelector('[data-base-ui-inert][role="presentation"]');
}

describe.skipIf(!isJSDOM)('<AlertDialog.Root />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('opens on trigger click with role="alertdialog" and closes on close press', async () => {
    render(() => (
      <AlertDialog.Root>
        <AlertDialog.Trigger data-testid="trigger">Open</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup">
            <AlertDialog.Title>Title text</AlertDialog.Title>
            <AlertDialog.Description>Description text</AlertDialog.Description>
            <AlertDialog.Close data-testid="close">Close</AlertDialog.Close>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(trigger);
    await settle();

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'alertdialog');
    expect(popup).toHaveAttribute('data-open');

    fireEvent.click(screen.getByTestId('close'));
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('is always modal and renders an internal backdrop', async () => {
    render(() => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup" />
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();

    expect(getInternalBackdrop()).not.toBeNull();
  });

  it('does not close on outside press', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup" />
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();

    outsideMousePress(getInternalBackdrop()!);
    await settle();

    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('closes on Escape with the escapeKey reason', async () => {
    const handleOpenChange = vi.fn();
    render(() => (
      <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup" />
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await settle();

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('supports controlled open', async () => {
    const [open, setOpen] = createSignal(false);
    render(() => (
      <AlertDialog.Root open={open()}>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid="popup" />
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ));
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();

    setOpen(true);
    await settle();
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    setOpen(false);
    await settle();
    expect(screen.queryByTestId('popup')).toBeNull();
  });

  it('works with a detached trigger through a handle', async () => {
    const handle = AlertDialog.createHandle();
    render(() => (
      <>
        <AlertDialog.Trigger data-testid="trigger" handle={handle}>
          Open
        </AlertDialog.Trigger>
        <AlertDialog.Root handle={handle}>
          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="popup" />
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>
    ));
    await settle();

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });
});
