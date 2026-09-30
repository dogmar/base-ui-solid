import { describe, expect, test, vi } from 'vitest';
import { createSignal, flush, onCleanup, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';

import { mergePropsN } from '../../merge-props';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../index';
import type { FloatingContext } from '../types';
import { normalizeProp, useDismiss, type UseDismissProps } from './useDismiss';
import { useFocus } from './useFocus';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

/** Synchronous flush that never yields to the macrotask queue (keeps 0ms timers pending). */
function sync() {
  flush();
  flush();
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function App(props: UseDismissProps & { onClose?: () => void }) {
  const [open, setOpen] = createSignal(true, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange(openArg, data) {
      setOpen(openArg);
      const reason = data?.reason;
      if (props.outsidePress) {
        expect(reason).toBe(REASONS.outsidePress);
      } else if (props.escapeKey) {
        expect(reason).toBe(REASONS.escapeKey);
        if (!openArg) {
          props.onClose?.();
        }
      } else if (props.referencePress?.()) {
        expect(reason).toBe(REASONS.triggerPress);
      }
    },
  });
  const dismiss = useDismiss(context, props);

  return (
    <>
      <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
      <Show when={open()}>
        {(_) => {
          onCleanup(() => refs.setFloating(null));
          return (
            <div role="tooltip" {...mergePropsN([dismiss.floating])} ref={refs.setFloating}>
              <input />
            </div>
          );
        }}
      </Show>
    </>
  );
}

describe('useDismiss', () => {
  describe('default options', () => {
    test('registers outside press touch listeners as passive', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      try {
        render(() => <App />);
        await settle();

        await Promise.all(
          ['touchstart', 'touchmove', 'touchend'].map((eventName) =>
            waitFor(() => {
              expect(addEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function), {
                capture: true,
                passive: true,
              });
            }),
          ),
        );
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    test('dismisses with escape key', async () => {
      render(() => <App />);
      await settle();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await settle();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('calls preventDefault on escape key dismiss', async () => {
      render(() => <App />);
      await settle();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      await settle();
      expect(event.defaultPrevented).toBe(true);
    });

    test('does not call preventDefault on escape key if close is canceled', async () => {
      function CancelApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange(openArg, data) {
            data?.cancel();
            setOpen(true);
          },
        });
        const dismiss = useDismiss(context);

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div role="tooltip" {...mergePropsN([dismiss.floating])} ref={refs.setFloating} />
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <CancelApp />);
      await settle();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with escape key if IME is active', async () => {
      const onClose = vi.fn();

      render(() => <App onClose={onClose} escapeKey />);
      await settle();

      const textbox = screen.getByRole('textbox');

      textbox.focus();
      await settle();

      // Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
      // cancellation.
      fireEvent.change(textbox, { target: { value: 'あ' } });
      fireEvent.compositionStart(textbox);
      fireEvent.keyDown(textbox, { key: 'Escape' });
      fireEvent.compositionEnd(textbox);

      // Wait for the compositionend timeout tick due to Safari
      await sleep(0);

      expect(onClose).toHaveBeenCalledTimes(0);

      fireEvent.keyDown(textbox, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('dismisses with outside pointer press', async () => {
      render(() => <App />);
      await settle();
      await userEvent.click(document.body);
      await settle();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('clears the inside marker when the interaction owner unmounts', async () => {
      const [interactionMounted, setInteractionMounted] = createSignal(true, { ownedWrite: true });
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      let context!: FloatingContext;

      function DismissInteraction() {
        const dismiss = useDismiss(context, { outsidePress: true, outsidePressEvent: 'sloppy' });
        return <button type="button" {...mergePropsN([dismiss.floating])} />;
      }

      function PersistentRootApp() {
        const floating = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        context = floating.context;

        return (
          <Show when={open()}>
            {(_) => {
              onCleanup(() => floating.refs.setFloating(null));
              return (
                <div role="tooltip" ref={floating.refs.setFloating}>
                  <Show when={interactionMounted()}>
                    <DismissInteraction />
                  </Show>
                </div>
              );
            }}
          </Show>
        );
      }

      render(() => <PersistentRootApp />);
      await settle();

      // A press inside the floating element marks the inside flag; the sloppy
      // handler early-returns for presses within own elements, so the marker
      // would go stale if the owner unmounted before the 0ms clear timer runs.
      fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'mouse' });
      setInteractionMounted(false);
      sync();
      setInteractionMounted(true);
      sync();
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with reference press', async () => {
      render(() => <App referencePress={() => true} />);
      await settle();
      fireEvent.pointerDown(screen.getByRole('button'));
      await settle();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with native click', async () => {
      render(() => <App referencePress={() => true} />);
      await settle();
      fireEvent.click(screen.getByRole('button'));
      await settle();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={() => false} />);
      await settle();
      await userEvent.click(document.body);
      await settle();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('outsidePress ignored for third party elements', async () => {
      function ThirdPartyApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context);

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div role="dialog" {...mergePropsN([dismiss.floating])} ref={refs.setFloating} />
                );
              }}
            </Show>
          </>
        );
      }

      const { container } = render(() => <ThirdPartyApp />);
      await settle();

      // The React test renders inside `FloatingFocusManager`, whose `markOthers`
      // marks the pre-existing outside elements as inert. Simulate that marking
      // here since the focus manager is a separate module.
      container.setAttribute('data-base-ui-inert', '');

      const thirdParty = document.createElement('div');
      thirdParty.setAttribute('data-testid', 'third-party');
      document.body.append(thirdParty);
      await userEvent.click(thirdParty);
      await settle();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      thirdParty.remove();

      // Clicking the root element still dismisses.
      await userEvent.click(document.body);
      await settle();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('dismisses when clicking outside a shared shadow root', async () => {
      function ShadowApp(props: { shadowRoot: ShadowRoot }) {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context);

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
            <FloatingPortal container={props.shadowRoot}>
              <Show when={open()}>
                {(_) => {
                  onCleanup(() => refs.setFloating(null));
                  return (
                    <div
                      role="dialog"
                      {...mergePropsN([dismiss.floating])}
                      ref={refs.setFloating}
                    />
                  );
                }}
              </Show>
            </FloatingPortal>
          </>
        );
      }

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(() => <ShadowApp shadowRoot={shadowRoot} />, { container });
        await settle();

        expect(shadowRoot.querySelector('[role="dialog"]')).not.toBe(null);

        await userEvent.click(document.body);
        await settle();

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('outsidePress not ignored for nested floating elements', async () => {
      function Popover(props: { children?: JSX.Element; id: string }) {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context);

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div
                    role="dialog"
                    data-testid={props.id}
                    {...mergePropsN([dismiss.floating])}
                    ref={refs.setFloating}
                  >
                    {props.children}
                  </div>
                );
              }}
            </Show>
          </>
        );
      }

      render(() => (
        <Popover id="popover-1">
          <Popover id="popover-2" />
        </Popover>
      ));
      await settle();

      const popover1 = screen.getByTestId('popover-1');
      const popover2 = screen.getByTestId('popover-2');
      await userEvent.click(popover2);
      await settle();
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      await settle();
      expect(screen.queryByTestId('popover-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('popover-1')).toBeInTheDocument();
    });
  });

  describe('options set to false', () => {
    test('does not dismiss with escape key', async () => {
      render(() => <App escapeKey={false} />);
      await settle();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await settle();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with outside press', async () => {
      render(() => <App outsidePress={false} />);
      await settle();
      await userEvent.click(document.body);
      await settle();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with reference pointer down', async () => {
      render(() => <App referencePress={() => false} />);
      await settle();
      await userEvent.click(screen.getByRole('button'));
      await settle();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss when clicking portaled children', async () => {
      function PortaledApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context);

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div {...mergePropsN([dismiss.floating])} ref={refs.setFloating}>
                    <FloatingPortal>
                      <button data-testid="portaled-button" />
                    </FloatingPortal>
                  </div>
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <PortaledApp />);
      await settle();

      fireEvent.pointerDown(screen.getByTestId('portaled-button'), { bubbles: true });
      await settle();

      expect(screen.getByTestId('portaled-button')).toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(() => <App outsidePress={() => true} />);
      await settle();
      await userEvent.click(document.body);
      await settle();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('normalizeProp', () => {
    test('undefined', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp();

      expect(escapeKeyBubbles).toBe(false);
      expect(outsidePressBubbles).toBe(true);
    });

    test('when true', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
        normalizeProp(true);

      expect(escapeKeyBubbles).toBe(true);
      expect(outsidePressBubbles).toBe(true);
    });

    test('when false', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
        normalizeProp(false);

      expect(escapeKeyBubbles).toBe(false);
      expect(outsidePressBubbles).toBe(false);
    });

    test('{}', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({});

      expect(escapeKeyBubbles).toBe(false);
      expect(outsidePressBubbles).toBe(true);
    });

    test('{ escapeKey: false }', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
        escapeKey: false,
      });

      expect(escapeKeyBubbles).toBe(false);
      expect(outsidePressBubbles).toBe(true);
    });

    test('{ escapeKey: true }', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
        escapeKey: true,
      });

      expect(escapeKeyBubbles).toBe(true);
      expect(outsidePressBubbles).toBe(true);
    });

    test('{ outsidePress: false }', () => {
      const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
        outsidePress: false,
      });

      expect(escapeKeyBubbles).toBe(false);
      expect(outsidePressBubbles).toBe(false);
    });
  });

  describe('prop: bubbles', () => {
    function Dialog(props: UseDismissProps & { testId: string; children?: JSX.Element }) {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const nodeId = useFloatingNodeId();

      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: (o) => setOpen(o),
        nodeId,
      });

      const dismiss = useDismiss(context, props);

      return (
        <FloatingNode id={nodeId}>
          <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
          <Show when={open()}>
            {(_) => {
              onCleanup(() => refs.setFloating(null));
              return (
                <div
                  {...mergePropsN([dismiss.floating])}
                  ref={refs.setFloating}
                  data-testid={props.testId}
                >
                  {props.children}
                </div>
              );
            }}
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { testId: string; children?: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('prop: bubbles.outsidePress', () => {
      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer">
            <NestedDialog testId="inner">
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: false }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ outsidePress: true }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: bubbles.escapeKey', () => {
      test('without FloatingTree', async () => {
        function EscapeApp() {
          const [popoverOpen, setPopoverOpen] = createSignal(true, { ownedWrite: true });
          const [tooltipOpen, setTooltipOpen] = createSignal(false, { ownedWrite: true });

          const popover = useFloating({
            get open() {
              return popoverOpen();
            },
            onOpenChange: (o) => setPopoverOpen(o),
          });
          const tooltip = useFloating({
            get open() {
              return tooltipOpen();
            },
            onOpenChange: (o) => setTooltipOpen(o),
          });

          const popoverDismiss = useDismiss(popover.context);
          const tooltipFocus = useFocus(tooltip.context);
          const tooltipDismiss = useDismiss(tooltip.context);

          return (
            <>
              <button ref={popover.refs.setReference} {...mergePropsN([popoverDismiss.reference])} />
              <Show when={popoverOpen()}>
                {(_) => {
                  onCleanup(() => popover.refs.setFloating(null));
                  return (
                    <div
                      role="dialog"
                      ref={popover.refs.setFloating}
                      {...mergePropsN([popoverDismiss.floating])}
                    >
                      <button
                        data-testid="focus-button"
                        ref={tooltip.refs.setReference}
                        {...mergePropsN([tooltipFocus.reference, tooltipDismiss.reference])}
                      />
                    </div>
                  );
                }}
              </Show>
              <Show when={tooltipOpen()}>
                {(_) => {
                  onCleanup(() => tooltip.refs.setFloating(null));
                  return (
                    <div
                      role="tooltip"
                      ref={tooltip.refs.setFloating}
                      {...mergePropsN([tooltipDismiss.floating])}
                    />
                  );
                }}
              </Show>
            </>
          );
        }

        render(() => <EscapeApp />);
        await settle();

        screen.getByTestId('focus-button').focus();
        await settle();

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        fireEvent.keyDown(screen.getByTestId('focus-button'), { key: 'Escape' });
        await settle();

        await waitFor(() => {
          expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      test('when true', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles>
            <NestedDialog testId="inner" bubbles>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: false }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(() => (
          <NestedDialog testId="outer" bubbles={{ escapeKey: true }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>
        ));
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        // The React test renders inside `FloatingFocusManager`, which moves
        // focus into the innermost dialog; the inner dialog's own keydown
        // handler then stops propagation before the outer (bubbling) document
        // listener sees the event. Fire from inside the inner dialog to match.
        fireEvent.keyDown(screen.getByRole('button', { name: 'test button' }), {
          key: 'Escape',
        });
        await settle();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.keyDown(document.body, { key: 'Escape' });
        await settle();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: capture', () => {
    function Overlay(props: { children?: JSX.Element }) {
      return (
        <div
          style={{ width: '100vw', height: '100vh' }}
          onPointerDown={(event: PointerEvent) => event.stopPropagation()}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        >
          <span>outside</span>
          {props.children}
        </div>
      );
    }

    function Dialog(props: UseDismissProps & { id: string; children?: JSX.Element }) {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const nodeId = useFloatingNodeId();

      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: (o) => setOpen(o),
        nodeId,
      });

      const dismiss = useDismiss(context, props);

      return (
        <FloatingNode id={nodeId}>
          <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
          <Show when={open()}>
            {(_) => {
              onCleanup(() => refs.setFloating(null));
              return (
                <FloatingPortal>
                  <div {...mergePropsN([dismiss.floating])} ref={refs.setFloating}>
                    <span>{props.id}</span>
                    {props.children}
                  </div>
                </FloatingPortal>
              );
            }}
          </Show>
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { id: string; children?: JSX.Element }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('prop: capture.outsidePress', () => {
      test('when true', async () => {
        const user = userEvent.setup();

        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));
        await settle();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.click(screen.getByText('outer'));
        await settle();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.click(screen.getByText('outside'));
        await settle();

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: capture.escapeKey', () => {
      test('when false', async () => {
        const user = userEvent.setup();

        render(() => (
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>
        ));
        await settle();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await settle();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await settle();

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('outsidePressEvent: intentional', () => {
    test('dragging outside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('dragging inside the floating element does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(floatingEl);
      // The browser fires the gesture's click on the common ancestor of the
      // mousedown and mouseup targets; the mouseup inside the floating element
      // marks the tree so this click must not dismiss.
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('dragging outside the floating element then clicking outside closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      // A click event will have fired before the proper outside click.
      fireEvent.click(document.body);
      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dragging outside the floating element then clicking outside closes with mouse clicks', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.pointerDown(floatingEl, { pointerType: 'mouse' });
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
      // and is consumed by the one-shot drag suppression.
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next press-backed mouse click closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('mouse click whose press started before open does not close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // The trailing click of a press that began before open, e.g. a menu item activated
      // by drag-release opening a dialog.
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed while open still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('compatibility events whose pointerdown opened the floating element do not count as a new press', async () => {
      function OpenOnPointerDownApp() {
        const [open, setOpen] = createSignal(false, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context, { outsidePressEvent: 'intentional' });

        return (
          <>
            <button onPointerDown={() => setOpen(true)}>Open</button>
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div role="tooltip" {...mergePropsN([dismiss.floating])} ref={refs.setFloating} />
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <OpenOnPointerDownApp />);
      await settle();

      const openButton = screen.getByRole('button', { name: 'Open' });
      fireEvent.pointerDown(openButton, { pointerType: 'mouse' });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The pointerdown happened before the floating element opened. Its
      // compatibility events arrive after opening but belong to the same press.
      fireEvent.mouseDown(openButton);
      fireEvent.mouseUp(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A new pointer press that begins while open still dismisses.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('keyboard-generated outside click without a prior press closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // Keyboard activations produce `detail: 0` clicks with no press.
      fireEvent.click(document.body, { detail: 0 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press-less outside click reporting a pointer type closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // Android assistive technology reports `pointerType: 'mouse'` with no press behind
      // it, so the click count is what separates the two.
      const click = new MouseEvent('click', { bubbles: true, detail: 0 });
      Object.defineProperty(click, 'pointerType', { value: 'mouse' });
      fireEvent(document.body, click);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen in a previous open session does not leak into a reopen', async () => {
      function ReopenApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const { refs, context } = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        const dismiss = useDismiss(context, { outsidePressEvent: 'intentional' });

        return (
          <>
            <button
              {...mergePropsN([dismiss.reference, { onClick: () => setOpen(true) }])}
              ref={refs.setReference}
            />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => refs.setFloating(null));
                return (
                  <div role="tooltip" {...mergePropsN([dismiss.floating])} ref={refs.setFloating} />
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <ReopenApp />);
      await settle();

      // A genuine outside press closes and leaves a press on record.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button'));
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The reopened session must not inherit the previous session's press:
      // a press-less trailing click still must not count as an outside press.
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press seen before a same-batch close and reopen does not leak into the new session', async () => {
      let context!: FloatingContext;

      function BatchReopenApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const floating = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        context = floating.context;
        const dismiss = useDismiss(floating.context, { outsidePressEvent: 'intentional' });

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={floating.refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => floating.refs.setFloating(null));
                return (
                  <div
                    role="tooltip"
                    {...mergePropsN([dismiss.floating])}
                    ref={floating.refs.setFloating}
                  />
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <BatchReopenApp />);
      await settle();

      // A press lands while the first session is open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // A same-batch close and reopen never commits `open === false`, so only
      // `openchange` can observe the session boundary.
      context.rootStore.setOpen(false, createChangeEventDetails(REASONS.none));
      context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The gesture's trailing click belongs to the previous session and must
      // not dismiss the reopened floating element.
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives a redundant open dispatch while already open', async () => {
      let context!: FloatingContext;

      function RedundantOpenApp() {
        const [open, setOpen] = createSignal(true, { ownedWrite: true });
        const floating = useFloating({
          get open() {
            return open();
          },
          onOpenChange: (o) => setOpen(o),
        });
        context = floating.context;
        const dismiss = useDismiss(floating.context, { outsidePressEvent: 'intentional' });

        return (
          <>
            <button {...mergePropsN([dismiss.reference])} ref={floating.refs.setReference} />
            <Show when={open()}>
              {(_) => {
                onCleanup(() => floating.refs.setFloating(null));
                return (
                  <div
                    role="tooltip"
                    {...mergePropsN([dismiss.floating])}
                    ref={floating.refs.setFloating}
                  />
                );
              }}
            </Show>
          </>
        );
      }

      render(() => <RedundantOpenApp />);
      await settle();

      // A genuine outside press lands while open.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
      // does not end the session, so the press stays on record.
      context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press survives listener re-attachment while open', async () => {
      const [escapeKeyProp, setEscapeKeyProp] = createSignal<boolean | undefined>(undefined, {
        ownedWrite: true,
      });

      render(() => <App outsidePressEvent="intentional" escapeKey={escapeKeyProp()} />);
      await settle();

      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.mouseDown(document.body);

      // Changing an effect dependency mid-gesture re-attaches the document listeners;
      // the observed press must survive that.
      setEscapeKeyProp(false);
      sync();

      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointerdown-only press while open allows the outside click to close', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // Pointer-event browsers may deliver `pointerdown` without a compat
      // `mousedown`; it must count as an observed press on its own.
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('non-primary-button press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // A right-button press produces `contextmenu`, not `click`, so it must
      // not vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 2 });
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A primary-button press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('cancelled press does not count as an outside press', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();

      // A press whose gesture is cancelled produces no click, so it must not
      // vouch for a later press-less click.
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      fireEvent.pointerCancel(document.body);
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A completed press still closes.
      fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      fireEvent.click(document.body, { detail: 1 });
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click then programmatic outside click closes', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(insideInput);
      fireEvent.mouseUp(insideInput);
      fireEvent.click(insideInput);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click after drag does not cause immediate close on first outside click', async () => {
      render(() => <App outsidePressEvent="intentional" />);
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Inside clicks should never dismiss, and they should not consume the
      // one-shot outside click suppression from the drag that started inside.
      fireEvent.click(insideInput);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // First true outside click after that drag is still ignored once.
      fireEvent.click(document.body);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next outside click is a deliberate outside press and dismisses.
      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('drag ending on outsidePress-ignored target does not consume next outside click', async () => {
      render(() => (
        <App
          outsidePressEvent="intentional"
          outsidePress={(event) => !(event.target as Element)?.closest('[data-testid="ignore"]')}
        />
      ));
      await settle();
      const floatingEl = screen.getByRole('tooltip');
      const ignored = document.createElement('div');
      ignored.setAttribute('data-testid', 'ignore');
      document.body.append(ignored);

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(ignored);

      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      ignored.remove();
    });

    function AppWithPreventedPressStart() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: (o) => setOpen(o),
      });
      const dismiss = useDismiss(context, { outsidePressEvent: 'intentional' });

      return (
        <>
          <button {...mergePropsN([dismiss.reference])} ref={refs.setReference} />
          <Show when={open()}>
            {(_) => {
              onCleanup(() => refs.setFloating(null));
              return (
                <div role="tooltip" {...mergePropsN([dismiss.floating])} ref={refs.setFloating}>
                  <div
                    data-testid="scrubber"
                    onPointerDown={(event: PointerEvent) => event.preventDefault()}
                  />
                </div>
              );
            }}
          </Show>
        </>
      );
    }

    test('press start prevented inside does not require double outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      await settle();
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      // Wait a tick: if no immediate synthetic click occurred after pointerup,
      // the next user click should still dismiss.
      await sleep(0);

      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(document.body, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });
      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press start prevented inside suppresses only immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      await settle();
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      fireEvent.click(document.body);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await sleep(0);

      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointercancel after prevented press start suppresses immediate outside click', async () => {
      render(() => <AppWithPreventedPressStart />);
      await settle();
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerCancel(document.body, { pointerType: 'mouse' });

      fireEvent.click(document.body);
      sync();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await sleep(0);

      fireEvent.click(document.body);
      sync();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('nested floating elements with different portal containers', async () => {
    function ButtonWithFloating(props: {
      children?: JSX.Element;
      portalContainer?: HTMLElement | null;
      triggerText: string;
    }) {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: (o) => setOpen(o),
      });

      const dismiss = useDismiss(context);

      return (
        <>
          <button
            ref={refs.setReference}
            {...mergePropsN([dismiss.reference, { onClick: () => setOpen(true) }])}
          >
            {props.triggerText}
          </button>
          <Show when={open()}>
            {(_) => {
              onCleanup(() => refs.setFloating(null));
              return (
                <FloatingPortal container={props.portalContainer}>
                  <div ref={refs.setFloating} {...mergePropsN([dismiss.floating])}>
                    {props.children}
                  </div>
                </FloatingPortal>
              );
            }}
          </Show>
        </>
      );
    }

    function NestedPortalApp() {
      const [otherContainer, setOtherContainer] = createSignal<HTMLElement | null>(null, {
        ownedWrite: true,
      });

      return (
        <>
          <ButtonWithFloating triggerText="open 1">
            <ButtonWithFloating triggerText="open 2" portalContainer={otherContainer()}>
              <button>nested</button>
            </ButtonWithFloating>
          </ButtonWithFloating>
          <div ref={setOtherContainer} />
        </>
      );
    }

    render(() => <NestedPortalApp />);
    await settle();

    await userEvent.click(screen.getByText('open 1'));
    await settle();
    expect(screen.getByText('open 2')).toBeInTheDocument();

    await userEvent.click(screen.getByText('open 2'));
    await settle();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();

    // Clicking the deepest portaled child dismisses neither ancestor, even
    // though both floating elements live in different DOM containers.
    await userEvent.click(screen.getByText('nested'));
    await settle();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});
