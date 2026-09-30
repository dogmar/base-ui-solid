import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Drawer.Popup />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('warns in development when not rendered within a viewport', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(() => (
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Portal>
        </Drawer.Root>
      ));
      await settle();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Base UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>.',
          ),
        );
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('defaults initial focus to the popup element', async () => {
    render(() => (
      <Drawer.Root>
        <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <input aria-label="Field" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
  });

  it('leaves focus on the trigger when initial focus is disabled', async () => {
    render(() => (
      <Drawer.Root modal={false}>
        <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup" initialFocus={false}>
              <input aria-label="Field" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    await Promise.resolve();

    expect(screen.getByTestId('popup')).not.toHaveFocus();
  });

  it('stops composite navigation keys from escaping the popup', async () => {
    const handleKeyDown = vi.fn();
    render(() => (
      <div onKeyDown={handleKeyDown}>
        <Drawer.Root open modal={false}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <input aria-label="Field" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    ));
    await settle();

    const field = screen.getByRole('textbox', { name: 'Field' });
    field.focus();
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(handleKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: 'a' });
    expect(handleKeyDown).toHaveBeenCalled();
  });

  it('marks nested drawers and parents with drawer-specific attributes', async () => {
    render(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root>
                <Drawer.Trigger data-testid="nested-trigger">Open nested</Drawer.Trigger>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="nested-popup" />
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const parentPopup = screen.getByTestId('parent-popup');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

    fireEvent.click(screen.getByTestId('nested-trigger'));
    await settle();

    const nestedPopup = screen.getByTestId('nested-popup');
    expect(nestedPopup).toHaveAttribute('data-nested');
    await waitFor(() => {
      expect(parentPopup).toHaveAttribute('data-nested-drawer-open');
    });
    // Drawer popups use drawer-specific nested state attributes.
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
  });
});
