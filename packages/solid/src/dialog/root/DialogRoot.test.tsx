import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Dialog } from '..';
import type { DialogRoot } from './DialogRoot';
import type { DialogTrigger } from '../trigger/DialogTrigger';
import type { DialogPopup } from '../popup/DialogPopup';
import { REASONS } from '../../internals/reasons';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

interface TestDialogProps {
  rootProps?: DialogRoot.Props | undefined;
  triggerProps?: DialogTrigger.Props | undefined;
  popupProps?: DialogPopup.Props | undefined;
  includeBackdrop?: boolean | undefined;
  keepMounted?: boolean | undefined;
}

function ContainedTriggerDialog(props: TestDialogProps): JSX.Element {
  return (
    <Dialog.Root {...(props.rootProps ?? {})}>
      <Dialog.Trigger data-testid="trigger" {...(props.triggerProps ?? {})}>
        Open
      </Dialog.Trigger>
      <Dialog.Portal keepMounted={props.keepMounted}>
        {props.includeBackdrop ? <Dialog.Backdrop data-testid="backdrop" /> : null}
        <Dialog.Popup data-testid="popup" {...(props.popupProps ?? {})}>
          <Dialog.Title>Title text</Dialog.Title>
          <Dialog.Description>Description text</Dialog.Description>
          <p>Dialog content</p>
          <Dialog.Close data-testid="close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetachedTriggerDialog(props: TestDialogProps): JSX.Element {
  const dialogHandle = Dialog.createHandle();

  return (
    <>
      <Dialog.Trigger data-testid="trigger" handle={dialogHandle} {...(props.triggerProps ?? {})}>
        Open
      </Dialog.Trigger>
      <Dialog.Root handle={dialogHandle} {...(props.rootProps ?? {})}>
        <Dialog.Portal keepMounted={props.keepMounted}>
          {props.includeBackdrop ? <Dialog.Backdrop data-testid="backdrop" /> : null}
          <Dialog.Popup data-testid="popup" {...(props.popupProps ?? {})}>
            <Dialog.Title>Title text</Dialog.Title>
            <Dialog.Description>Description text</Dialog.Description>
            <p>Dialog content</p>
            <Dialog.Close data-testid="close">Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/**
 * Simulates an "intentional" outside mouse press: a press that begins and ends
 * on the target while the popup is open, followed by its click.
 */
function outsideMousePress(target: Element) {
  fireEvent.pointerDown(target, { pointerType: 'mouse' });
  fireEvent.mouseDown(target);
  fireEvent.mouseUp(target);
  fireEvent.click(target, { detail: 1 });
}

function getInternalBackdrop(): Element | null {
  return document.querySelector('[data-base-ui-inert][role="presentation"]');
}

describe.skipIf(!isJSDOM)('<Dialog.Root />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  describe.each([
    ['contained trigger', ContainedTriggerDialog],
    ['detached trigger', DetachedTriggerDialog],
  ] as Array<[string, (props: TestDialogProps) => JSX.Element]>)(
    'when using %s',
    (_name, TestDialog) => {
      describe('uncontrolled open', () => {
        it('opens on trigger click and closes on close press', async () => {
          render(() => <TestDialog />);
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(screen.getByTestId('popup')).toBeInTheDocument();

          fireEvent.click(screen.getByTestId('close'));
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();
        });

        it('renders open initially with defaultOpen', async () => {
          render(() => <TestDialog rootProps={{ defaultOpen: true }} />);
          await settle();

          expect(screen.getByTestId('popup')).toBeInTheDocument();
        });
      });

      describe('controlled open', () => {
        it('follows the open prop', async () => {
          const [open, setOpen] = createSignal(false);
          render(() => <TestDialog rootProps={{ open: open() }} />);
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();

          setOpen(true);
          await settle();
          expect(screen.getByTestId('popup')).toBeInTheDocument();

          setOpen(false);
          await settle();
          expect(screen.queryByTestId('popup')).toBeNull();
        });
      });

      describe('prop: onOpenChange', () => {
        it('calls onOpenChange with the new open state', async () => {
          const handleOpenChange = vi.fn();
          const [open, setOpen] = createSignal(false);
          render(() => (
            <TestDialog
              rootProps={{
                open: open(),
                onOpenChange: (nextOpen, eventDetails) => {
                  handleOpenChange(nextOpen, eventDetails);
                  setOpen(nextOpen);
                },
              }}
            />
          ));
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange.mock.calls[0][0]).toBe(true);

          fireEvent.click(screen.getByTestId('close'));
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(2);
          expect(handleOpenChange.mock.calls[1][0]).toBe(false);
        });

        it('calls onOpenChange with the reason for change when clicked on trigger and close button', async () => {
          const handleOpenChange = vi.fn();
          render(() => <TestDialog rootProps={{ onOpenChange: handleOpenChange }} />);
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();
          fireEvent.click(screen.getByTestId('close'));
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(2);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);
          expect(handleOpenChange.mock.calls[1][1].reason).toBe(REASONS.closePress);
        });

        it('calls onOpenChange with the reason for change when pressed Esc while the dialog is open', async () => {
          const handleOpenChange = vi.fn();
          render(() => (
            <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
          ));
          await settle();

          fireEvent.keyDown(document.body, { key: 'Escape' });
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
          expect(screen.queryByTestId('popup')).toBeNull();
        });

        it('calls onOpenChange with the reason for change when user clicks backdrop while the modal dialog is open', async () => {
          const handleOpenChange = vi.fn();
          render(() => (
            <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
          ));
          await settle();

          outsideMousePress(getInternalBackdrop()!);
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        });

        it('calls onOpenChange with the reason for change when user clicks outside while the non-modal dialog is open', async () => {
          const handleOpenChange = vi.fn();
          render(() => (
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
            />
          ));
          await settle();

          outsideMousePress(document.body);
          await settle();

          expect(handleOpenChange).toHaveBeenCalledTimes(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        });

        it('cancel() prevents opening while uncontrolled', async () => {
          render(() => (
            <TestDialog
              rootProps={{
                onOpenChange: (nextOpen, eventDetails) => {
                  if (nextOpen) {
                    eventDetails.cancel();
                  }
                },
              }}
            />
          ));
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();
        });
      });

      describe('prop: modal', () => {
        it('renders an internal backdrop when `true`', async () => {
          render(() => <TestDialog rootProps={{ modal: true }} />);
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(getInternalBackdrop()).not.toBeNull();
        });

        it('does not render an internal backdrop when `false`', async () => {
          render(() => <TestDialog rootProps={{ modal: false }} />);
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(screen.getByTestId('popup')).toBeInTheDocument();
          expect(getInternalBackdrop()).toBeNull();
        });

        it('does not render an internal backdrop when `trap-focus`', async () => {
          render(() => <TestDialog rootProps={{ modal: 'trap-focus' }} />);
          await settle();

          fireEvent.click(screen.getByTestId('trigger'));
          await settle();

          expect(screen.getByTestId('popup')).toBeInTheDocument();
          expect(getInternalBackdrop()).toBeNull();
        });

        it('closes on outside press when `trap-focus`', async () => {
          render(() => <TestDialog rootProps={{ defaultOpen: true, modal: 'trap-focus' }} />);
          await settle();

          outsideMousePress(document.body);
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();
        });
      });

      describe('prop: disablePointerDismissal', () => {
        it('does not close the dialog when clicking outside if disablePointerDismissal=true', async () => {
          render(() => (
            <TestDialog rootProps={{ defaultOpen: true, disablePointerDismissal: true }} />
          ));
          await settle();

          outsideMousePress(getInternalBackdrop()!);
          await settle();

          expect(screen.getByTestId('popup')).toBeInTheDocument();
        });

        it('closes the dialog when clicking outside if disablePointerDismissal=false', async () => {
          render(() => (
            <TestDialog rootProps={{ defaultOpen: true, disablePointerDismissal: false }} />
          ));
          await settle();

          outsideMousePress(getInternalBackdrop()!);
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();
        });
      });

      it('does not close on a right-button outside press', async () => {
        const handleOpenChange = vi.fn();
        render(() => (
          <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />
        ));
        await settle();

        const backdrop = getInternalBackdrop()!;
        fireEvent.pointerDown(backdrop, { pointerType: 'mouse', button: 2 });
        fireEvent.mouseDown(backdrop, { button: 2 });
        fireEvent.mouseUp(backdrop, { button: 2 });
        fireEvent.click(backdrop, { detail: 1, button: 2 });
        await settle();

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('popup')).toBeInTheDocument();
      });

      describe('prop: actionsRef', () => {
        it('closes the dialog when the `close` method is called', async () => {
          const actionsRef: { current: DialogRoot.Actions | null } = { current: null };
          const handleOpenChange = vi.fn();
          render(() => (
            <TestDialog
              rootProps={{ defaultOpen: true, actionsRef, onOpenChange: handleOpenChange }}
            />
          ));
          await settle();

          expect(actionsRef.current).not.toBeNull();
          actionsRef.current!.close();
          await settle();

          expect(screen.queryByTestId('popup')).toBeNull();
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.imperativeAction);
        });
      });
    },
  );

  describe('nested dialogs', () => {
    function NestedDialogs(props: { keepNestedMounted?: boolean }): JSX.Element {
      return (
        <Dialog.Root>
          <Dialog.Trigger data-testid="parent-trigger">Open parent</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="parent-popup">
              <Dialog.Root>
                <Dialog.Trigger data-testid="nested-trigger">Open nested</Dialog.Trigger>
                <Dialog.Portal keepMounted={props.keepNestedMounted}>
                  <Dialog.Popup data-testid="nested-popup">
                    <Dialog.Close data-testid="nested-close">Close nested</Dialog.Close>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
              <Dialog.Close data-testid="parent-close">Close parent</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    it('marks the nested popup with data-nested and the parent with data-nested-dialog-open', async () => {
      render(() => <NestedDialogs />);
      await settle();

      fireEvent.click(screen.getByTestId('parent-trigger'));
      await settle();

      const parentPopup = screen.getByTestId('parent-popup');
      expect(parentPopup).not.toHaveAttribute('data-nested');
      expect(parentPopup).not.toHaveAttribute('data-nested-dialog-open');

      fireEvent.click(screen.getByTestId('nested-trigger'));
      await settle();

      const nestedPopup = screen.getByTestId('nested-popup');
      expect(nestedPopup).toHaveAttribute('data-nested');
      await waitFor(() => {
        expect(parentPopup).toHaveAttribute('data-nested-dialog-open');
      });
    });

    it('provides the number of open nested dialogs as a CSS variable', async () => {
      render(() => <NestedDialogs />);
      await settle();

      fireEvent.click(screen.getByTestId('parent-trigger'));
      await settle();

      const parentPopup = screen.getByTestId('parent-popup');
      expect(parentPopup.style.getPropertyValue('--nested-dialogs')).toBe('0');

      fireEvent.click(screen.getByTestId('nested-trigger'));
      await settle();

      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--nested-dialogs')).toBe('1');
      });

      fireEvent.click(screen.getByTestId('nested-close'));
      await settle();

      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--nested-dialogs')).toBe('0');
      });
    });

    it('closes only the topmost dialog on Escape', async () => {
      render(() => <NestedDialogs />);
      await settle();

      fireEvent.click(screen.getByTestId('parent-trigger'));
      await settle();
      fireEvent.click(screen.getByTestId('nested-trigger'));
      await settle();

      expect(screen.getByTestId('nested-popup')).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await settle();

      expect(screen.queryByTestId('nested-popup')).toBeNull();
      expect(screen.getByTestId('parent-popup')).toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await settle();

      expect(screen.queryByTestId('parent-popup')).toBeNull();
    });
  });

  describe('scroll lock', () => {
    it('locks page scroll while a modal dialog is open and releases it on close', async () => {
      render(() => <ContainedTriggerDialog />);
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();

      await waitFor(() => {
        expect(document.documentElement).toHaveAttribute('data-base-ui-scroll-locked');
      });

      fireEvent.click(screen.getByTestId('close'));
      await settle();

      await waitFor(() => {
        expect(document.documentElement).not.toHaveAttribute('data-base-ui-scroll-locked');
      });
    });

    it('does not lock page scroll for non-modal dialogs', async () => {
      render(() => <ContainedTriggerDialog rootProps={{ modal: false }} />);
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();
      // Wait past the scroll locker's deferred 0ms lock.
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(document.documentElement).not.toHaveAttribute('data-base-ui-scroll-locked');
    });

    it('does not lock page scroll for trap-focus dialogs', async () => {
      render(() => <ContainedTriggerDialog rootProps={{ modal: 'trap-focus' }} />);
      await settle();

      fireEvent.click(screen.getByTestId('trigger'));
      await settle();
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(document.documentElement).not.toHaveAttribute('data-base-ui-scroll-locked');
    });
  });
});
