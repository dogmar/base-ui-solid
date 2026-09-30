import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe.skipIf(!isJSDOM)('<Dialog.Trigger />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('throws a descriptive error without a root or handle', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(() => <Dialog.Trigger>Open</Dialog.Trigger>)).toThrow(
      /must be used within <Dialog.Root> or provided with a handle/,
    );
    spy.mockRestore();
  });

  it('has correct ARIA attributes and popup-open state attribute', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup" />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');

    fireEvent.click(trigger);
    await settle();

    const popup = screen.getByTestId('popup');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.id);
  });

  describe('prop: disabled', () => {
    it('disables the dialog', async () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger" disabled>
            Open
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup" />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      fireEvent.click(trigger);
      await settle();

      expect(screen.queryByTestId('popup')).toBeNull();
    });
  });
});
