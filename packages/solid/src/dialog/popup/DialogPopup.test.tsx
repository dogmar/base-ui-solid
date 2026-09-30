import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Dialog } from '..';
import type { DialogPopup } from './DialogPopup';
import { createRef } from '../../solid-utils/refs';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Dialog.Popup />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('throws a descriptive error when rendered outside <Dialog.Root>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(() => <Dialog.Popup />)).toThrow(
      /DialogRootContext is missing|<Dialog.Portal> is missing/,
    );
    spy.mockRestore();
  });

  describe('prop: keepMounted', () => {
    it('keeps the dialog mounted in the DOM when the portal has keepMounted=true', async () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal keepMounted>
            <Dialog.Popup data-testid="popup" />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const popup = screen.getByTestId('popup');
      expect(popup).toBeInTheDocument();
      expect(popup).toHaveAttribute('hidden');
      expect(popup).toHaveAttribute('data-closed');

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      expect(popup).not.toHaveAttribute('hidden');
      expect(popup).toHaveAttribute('data-open');
    });

    it('does not keep the dialog mounted when keepMounted is not set', async () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup" />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      expect(screen.queryByTestId('popup')).toBeNull();
    });
  });

  describe('ARIA attributes', () => {
    it('renders role="dialog" and wires the title and description ids', async () => {
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">
              <Dialog.Title data-testid="title">Title text</Dialog.Title>
              <Dialog.Description data-testid="description">Description text</Dialog.Description>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const popup = screen.getByTestId('popup');
      const title = screen.getByTestId('title');
      const description = screen.getByTestId('description');

      expect(popup).toHaveAttribute('role', 'dialog');
      expect(popup.getAttribute('aria-labelledby')).toBe(title.id);
      expect(popup.getAttribute('aria-describedby')).toBe(description.id);
    });

    it('removes aria-labelledby and aria-describedby when the parts unmount', async () => {
      const [showParts, setShowParts] = (await import('solid-js')).createSignal(true);
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup">
              {showParts() ? <Dialog.Title>Title text</Dialog.Title> : null}
              {showParts() ? <Dialog.Description>Description text</Dialog.Description> : null}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const popup = screen.getByTestId('popup');
      expect(popup).toHaveAttribute('aria-labelledby');

      setShowParts(false);
      await settle();

      expect(popup).not.toHaveAttribute('aria-labelledby');
      expect(popup).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('prop: initialFocus', () => {
    function TestDialog(props: {
      initialFocus?: DialogPopup.Props['initialFocus'];
      extraContent?: JSX.Element;
    }): JSX.Element {
      return (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="popup" initialFocus={props.initialFocus}>
              <input data-testid="first-input" />
              <input data-testid="second-input" />
              {props.extraContent}
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    it('focuses the first focusable element within the popup by default', async () => {
      render(() => <TestDialog />);
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      await waitFor(() => {
        expect(screen.getByTestId('first-input')).toHaveFocus();
      });
    });

    it('focuses the element provided as a ref when open', async () => {
      const inputRef = createRef<HTMLInputElement>();
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup initialFocus={inputRef}>
              <input data-testid="first-input" />
              <input
                data-testid="second-input"
                ref={(el) => {
                  inputRef.current = el;
                }}
              />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      await waitFor(() => {
        expect(screen.getByTestId('second-input')).toHaveFocus();
      });
    });

    it('focuses the element returned by the function when open', async () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup
              initialFocus={() => document.querySelector<HTMLElement>('[data-testid="second-input"]')}
            >
              <input data-testid="first-input" />
              <input data-testid="second-input" />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      await waitFor(() => {
        expect(screen.getByTestId('second-input')).toHaveFocus();
      });
    });

    it('does not move focus when initialFocus is false', async () => {
      render(() => <TestDialog initialFocus={false} />);
      await settle();

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      fireEvent.click(trigger);
      await settle();
      await Promise.resolve();

      expect(screen.getByTestId('first-input')).not.toHaveFocus();
    });
  });

  describe('prop: finalFocus', () => {
    it('focuses the trigger by default when closed', async () => {
      render(() => (
        <Dialog.Root>
          <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close data-testid="close">Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ));
      await settle();

      const trigger = screen.getByTestId('trigger');
      fireEvent.click(trigger);
      await settle();

      fireEvent.click(screen.getByTestId('close'));
      await settle();

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('focuses the element provided to the prop when closed', async () => {
      const finalRef = createRef<HTMLButtonElement>();
      render(() => (
        <>
          <button
            data-testid="final"
            ref={(el) => {
              finalRef.current = el;
            }}
          >
            Final
          </button>
          <Dialog.Root>
            <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup finalFocus={finalRef}>
                <Dialog.Close data-testid="close">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      fireEvent.click(screen.getByTestId('close'));
      await settle();

      await waitFor(() => {
        expect(screen.getByTestId('final')).toHaveFocus();
      });
    });
  });
});
