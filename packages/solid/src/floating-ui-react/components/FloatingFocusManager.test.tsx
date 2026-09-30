import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { JSX } from '@solidjs/web';
import { FloatingPortal, useFloating } from '../index';
import { FloatingFocusManager, type FloatingFocusManagerProps } from './FloatingFocusManager';
import { createRef } from '../../solid-utils/refs';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function App(
  props: Partial<
    Omit<FloatingFocusManagerProps, 'initialFocus' | 'context'> & {
      initialFocus?: 'two' | FloatingFocusManagerProps['initialFocus'];
      children?: JSX.Element;
    }
  >,
) {
  const twoRef = createRef<HTMLElement>();
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: (nextOpen) => setOpen(nextOpen),
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <Show when={open()}>
        <FloatingFocusManager
          context={context}
          initialFocus={props.initialFocus === 'two' ? twoRef : props.initialFocus}
          returnFocus={props.returnFocus}
          restoreFocus={props.restoreFocus}
          modal={props.modal}
          closeOnFocusOut={props.closeOnFocusOut}
          disabled={props.disabled}
          getInsideElements={props.getInsideElements}
        >
          <div role="dialog" ref={refs.setFloating} data-testid="floating">
            <button data-testid="one">close</button>
            <button
              data-testid="two"
              ref={(el) => {
                twoRef.current = el;
              }}
            >
              confirm
            </button>
            <button data-testid="three" onClick={() => setOpen(false)}>
              x
            </button>
            {props.children}
          </div>
        </FloatingFocusManager>
      </Show>
      <div tabindex={0} data-testid="last">
        outside
      </div>
    </>
  );
}

function RadioApp() {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: (nextOpen) => setOpen(nextOpen),
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
      <Show when={open()}>
        <FloatingFocusManager context={context}>
          <div role="dialog" ref={refs.setFloating}>
            <input type="radio" name="group" data-testid="radio-one" />
            <input type="radio" name="group" checked data-testid="radio-two" />
            <button data-testid="after-radio">after</button>
          </div>
        </FloatingFocusManager>
      </Show>
    </>
  );
}

describe('FloatingFocusManager', () => {
  describe('prop: initialFocus', () => {
    it('default behavior focuses first tabbable element', async () => {
      render(() => <App />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('one')).toHaveFocus();
    });

    it('default behavior focuses the checked radio in a named group', async () => {
      render(() => <RadioApp />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('radio-two')).toHaveFocus();
    });

    it('ref', async () => {
      render(() => <App initialFocus="two" />);
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('two')).toHaveFocus();
    });

    it('false does not move focus', async () => {
      render(() => <App initialFocus={false} />);

      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });

    it('function form receives the open interaction type and can return an element', async () => {
      const initialFocus = vi.fn((_type: string) => null);
      function FnApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });
        return (
          <>
            <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(true)} />
            <Show when={open()}>
              <FloatingFocusManager
                context={context}
                openInteractionType="mouse"
                initialFocus={initialFocus}
              >
                <div role="dialog" ref={refs.setFloating} data-testid="floating">
                  <button data-testid="one" />
                </div>
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <FnApp />);
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(initialFocus).toHaveBeenCalledWith('mouse');
      // `null` falls back to the default behavior (first tabbable element).
      expect(screen.getByTestId('one')).toHaveFocus();
    });
  });

  describe('prop: returnFocus', () => {
    it('when true', async () => {
      const [returnFocus, setReturnFocus] = createSignal<boolean | undefined>(undefined, {
        ownedWrite: true,
      });
      render(() => <App returnFocus={returnFocus()} />);

      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('one')).toHaveFocus();

      screen.getByTestId('two').focus();
      await flushMicrotasks();

      setReturnFocus(false);
      await flushMicrotasks();

      expect(screen.getByTestId('two')).toHaveFocus();

      fireEvent.click(screen.getByTestId('three'));
      await flushMicrotasks();
      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });

    it('returns focus to the reference on close when true', async () => {
      render(() => <App />);

      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('one')).toHaveFocus();

      fireEvent.click(screen.getByTestId('three'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });

    it('when false', async () => {
      render(() => <App returnFocus={false} />);

      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('one')).toHaveFocus();

      fireEvent.click(screen.getByTestId('three'));
      await flushMicrotasks();
      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });

    it('ref', async () => {
      const focusTargetRef = createRef<HTMLElement>();
      function Test() {
        return (
          <div>
            <input />
            <input
              data-testid="focus-target"
              ref={(el) => {
                focusTargetRef.current = el;
              }}
            />
            <input />
            <App returnFocus={focusTargetRef} />
          </div>
        );
      }

      render(() => <Test />);
      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('three'));
      await flushMicrotasks();
      expect(screen.getByTestId('focus-target')).toHaveFocus();
    });

    it('function returning undefined does not move focus', async () => {
      render(() => <App returnFocus={() => undefined} />);

      screen.getByTestId('reference').focus();
      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('one')).toHaveFocus();

      fireEvent.click(screen.getByTestId('three'));
      await flushMicrotasks();
      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });
  });

  describe('prop: modal', () => {
    it('when true', async () => {
      render(() => <App modal />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      await userEvent.tab();
      expect(screen.getByTestId('two')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('three')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('three')).toHaveFocus();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('two')).toHaveFocus();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('one')).toHaveFocus();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('three')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();
    });

    it('when false', async () => {
      render(() => <App modal={false} />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      await userEvent.tab();
      expect(screen.getByTestId('two')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('three')).toHaveFocus();

      await userEvent.tab();

      // Wait for the microtask that wraps the close on focus-out.
      await flushMicrotasks();

      // Focus leaving the floating element closes it.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      expect(screen.getByTestId('last')).toHaveFocus();
    });

    it('closeOnFocusOut: false keeps a non-modal element open when focus leaves', async () => {
      render(() => <App modal={false} closeOnFocusOut={false} />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toBeInTheDocument();

      await userEvent.tab();
      expect(screen.getByTestId('two')).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByTestId('three')).toHaveFocus();

      // Move focus out of the floating element entirely.
      await userEvent.tab();
      await flushMicrotasks();

      // With `closeOnFocusOut={false}`, focus leaving the floating element does not close it.
      expect(screen.getByTestId('floating')).toBeInTheDocument();
      expect(screen.getByTestId('last')).toHaveFocus();
    });

    it('fallback to floating element when it has no tabbable content', async () => {
      function FallbackApp() {
        const { refs, context } = useFloating({
          get open() {
            return true;
          },
        });
        return (
          <>
            <button data-testid="reference" ref={refs.setReference} />
            <FloatingFocusManager context={context} modal>
              <div ref={refs.setFloating} data-testid="floating" tabindex={-1} />
            </FloatingFocusManager>
          </>
        );
      }

      render(() => <FallbackApp />);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('floating')).toHaveFocus();
      });
      await userEvent.tab();
      expect(screen.getByTestId('floating')).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('floating')).toHaveFocus();
    });

    it('true - applies aria-hidden to outside nodes', async () => {
      function AriaApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <input data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
            <div data-testid="outside-wrapper">
              <div data-testid="aria-live" aria-live="polite" />
              <button data-testid="btn-1" />
              <button data-testid="btn-2" />
            </div>
            <Show when={open()}>
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <AriaApp />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true');

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden');
    });

    it('true - keeps supplied inside elements outside the floating node exposed to assistive tech', async () => {
      function InsideApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const dismissRef = createRef<HTMLButtonElement>();
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <input data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
            <div data-testid="outside-wrapper">
              <button data-testid="outside-button" />
            </div>
            <Show when={open()}>
              <FloatingFocusManager
                context={context}
                getInsideElements={() => [dismissRef.current]}
              >
                <>
                  <div ref={refs.setFloating} data-testid="floating" />
                  <button
                    ref={(el) => {
                      dismissRef.current = el;
                    }}
                    data-testid="dismiss"
                  />
                </>
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <InsideApp />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('dismiss')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('aria-hidden', 'true');
    });

    it('false - does not apply inert to outside nodes', async () => {
      function MarkerApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <input data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
            <div data-testid="outside-wrapper">
              <div data-testid="aria-live" aria-live="polite" />
              <button data-testid="btn-1" />
              <button data-testid="btn-2" />
            </div>
            <Show when={open()}>
              <FloatingFocusManager context={context} modal={false}>
                <div role="listbox" ref={refs.setFloating} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <MarkerApp />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('aria-live')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('reference')).toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
    });

    it('false - comboboxes do not hide all other nodes', async () => {
      function ComboboxApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <input
              role="combobox"
              data-testid="reference"
              ref={refs.setReference}
              onFocus={() => setOpen(true)}
            />
            <button data-testid="btn-1" />
            <button data-testid="btn-2" />
            <Show when={open()}>
              <FloatingFocusManager context={context} modal={false}>
                <div role="listbox" ref={refs.setFloating} data-testid="floating" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <ComboboxApp />);

      fireEvent.focus(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
    });
  });

  describe('prop: disabled', () => {
    it('true -> false', async () => {
      function DisabledApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const [disabled, setDisabled] = createSignal(true, { ownedWrite: true });

        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open())} />
            <button data-testid="toggle" onClick={() => setDisabled(!disabled())} />
            <Show when={open()}>
              <FloatingFocusManager context={context} disabled={disabled()}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog" />
              </FloatingFocusManager>
            </Show>
          </>
        );
      }

      render(() => <DisabledApp />);

      fireEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('floating')).not.toHaveFocus();
      fireEvent.click(screen.getByTestId('toggle'));
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('floating')).toHaveFocus();
      });
    });
  });

  describe('non-modal + FloatingPortal', () => {
    it('focuses inside element, tabbing out focuses last document element', async () => {
      function PortalApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <span tabindex={0} data-testid="first" />
            <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(true)} />
            <FloatingPortal>
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div data-testid="floating" ref={refs.setFloating}>
                    <span tabindex={0} data-testid="inside" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </FloatingPortal>
            <span tabindex={0} data-testid="last" />
          </>
        );
      }

      render(() => <PortalApp />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('inside')).toHaveFocus();

      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
      expect(screen.getByTestId('last')).toHaveFocus();
    });

    it('shift+tab', async () => {
      function PortalApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <span tabindex={0} data-testid="first" />
            <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(true)} />
            <FloatingPortal>
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div data-testid="floating" ref={refs.setFloating}>
                    <span tabindex={0} data-testid="inside" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </FloatingPortal>
            <span tabindex={0} data-testid="last" />
          </>
        );
      }

      render(() => <PortalApp />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      await userEvent.tab({ shift: true });
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toBeInTheDocument();

      await userEvent.tab({ shift: true });
      await flushMicrotasks();

      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
    });

    it('does not mark reference siblings due to outside focus guards', async () => {
      function PortalApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (nextOpen) => setOpen(nextOpen),
        });

        return (
          <>
            <div data-testid="reference-wrapper">
              <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(true)} />
              <span data-testid="reference-sibling-1" />
              <span data-testid="reference-sibling-2" />
            </div>
            <FloatingPortal>
              <Show when={open()}>
                <FloatingFocusManager context={context} modal={false}>
                  <div data-testid="floating" ref={refs.setFloating}>
                    <span tabindex={0} data-testid="inside" />
                  </div>
                </FloatingFocusManager>
              </Show>
            </FloatingPortal>
          </>
        );
      }

      render(() => <PortalApp />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toBeInTheDocument();
      expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('reference-sibling-1')).not.toHaveAttribute('data-base-ui-inert');
      expect(screen.getByTestId('reference-sibling-2')).not.toHaveAttribute('data-base-ui-inert');
    });
  });
});
