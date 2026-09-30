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

describe.skipIf(!isJSDOM)('<Dialog.Backdrop />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('has role="presentation" and transition data attributes', async () => {
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('data-open');
  });

  it('has data-closed when rendered while closed via keepMounted', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
        <Dialog.Portal keepMounted>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('data-closed');
    expect(backdrop).toHaveAttribute('hidden');

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop).not.toHaveAttribute('hidden');
  });

  describe('prop: forceRender', () => {
    it('renders only the root backdrop by default', async () => {
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Backdrop data-testid="parent-backdrop" />
            <Dialog.Popup>
              <Dialog.Root defaultOpen>
                <Dialog.Portal>
                  <Dialog.Backdrop data-testid="nested-backdrop" />
                  <Dialog.Popup />
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      expect(screen.getByTestId('parent-backdrop')).toBeInTheDocument();
      expect(screen.queryByTestId('nested-backdrop')).toBeNull();
    });

    it('always renders when true', async () => {
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Backdrop data-testid="parent-backdrop" />
            <Dialog.Popup>
              <Dialog.Root defaultOpen>
                <Dialog.Portal>
                  <Dialog.Backdrop data-testid="nested-backdrop" forceRender />
                  <Dialog.Popup />
                </Dialog.Portal>
              </Dialog.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      expect(screen.getByTestId('nested-backdrop')).toBeInTheDocument();
    });
  });
});
