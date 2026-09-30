import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Dialog } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Dialog.Viewport />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders only when the dialog is mounted by default', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup />
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    expect(screen.queryByTestId('viewport')).toBeNull();

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    const viewport = screen.getByTestId('viewport');
    expect(viewport).toBeInTheDocument();
    expect(viewport).toHaveAttribute('role', 'presentation');
    expect(viewport).toHaveAttribute('data-open');
  });

  it('stays mounted when used within a keepMounted portal', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Portal keepMounted>
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup />
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const viewport = screen.getByTestId('viewport');
    expect(viewport).toBeInTheDocument();
    expect(viewport).toHaveAttribute('hidden');
    expect(viewport).toHaveAttribute('data-closed');
  });
});
