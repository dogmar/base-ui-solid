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

describe.skipIf(!isJSDOM)('<Dialog.Close />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('closes the dialog when clicked', async () => {
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Close data-testid="close">Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    fireEvent.click(screen.getByTestId('close'));
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });

  describe('prop: disabled', () => {
    it('disables the button and does not close the dialog', async () => {
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">
              <Dialog.Close data-testid="close" disabled>
                Close
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const close = screen.getByTestId('close');
      expect(close).toHaveAttribute('disabled');
      expect(close).toHaveAttribute('data-disabled');

      fireEvent.click(close);
      await settle();

      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
  });
});
