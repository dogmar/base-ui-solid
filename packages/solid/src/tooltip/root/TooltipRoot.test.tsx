/* eslint-disable react/jsx-fragments */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';
import type { TooltipRoot } from './TooltipRoot';
import type { TooltipTrigger } from '../trigger/TooltipTrigger';
import { OPEN_DELAY } from '../utils/constants';
import { REASONS } from '../../internals/reasons';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await settle();
}

interface TestTooltipProps {
  rootProps?: TooltipRoot.Props | undefined;
  triggerProps?: TooltipTrigger.Props | undefined;
}

function ContainedTriggerTooltip(props: TestTooltipProps): JSX.Element {
  return (
    <Tooltip.Root {...(props.rootProps ?? {})}>
      <Tooltip.Trigger data-testid="trigger" {...(props.triggerProps ?? {})}>
        Toggle
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner data-testid="positioner">
          <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function DetachedTriggerTooltip(props: TestTooltipProps): JSX.Element {
  const tooltipHandle = Tooltip.createHandle();

  return (
    <>
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...(props.triggerProps ?? {})}>
        Toggle
      </Tooltip.Trigger>
      <Tooltip.Root handle={tooltipHandle} {...(props.rootProps ?? {})}>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </>
  );
}

function MultipleDetachedTriggersTooltip(props: TestTooltipProps): JSX.Element {
  const tooltipHandle = Tooltip.createHandle();

  return (
    <>
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...(props.triggerProps ?? {})}>
        Toggle
      </Tooltip.Trigger>
      <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle}>
        Toggle another
      </Tooltip.Trigger>
      <Tooltip.Root handle={tooltipHandle} {...(props.rootProps ?? {})}>
        <Tooltip.Portal>
          <Tooltip.Positioner data-testid="positioner">
            <Tooltip.Popup data-testid="popup">Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </>
  );
}

function hoverTrigger(trigger: Element) {
  fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
  fireEvent.mouseEnter(trigger);
  fireEvent.mouseMove(trigger);
}

describe.skipIf(!isJSDOM)('<Tooltip.Root />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe.each([
    ['contained triggers', ContainedTriggerTooltip],
    ['detached triggers', DetachedTriggerTooltip],
    ['multiple detached triggers', MultipleDetachedTriggersTooltip],
  ] as Array<[string, (props: TestTooltipProps) => JSX.Element]>)(
    'when using %s',
    (_name, TestTooltip) => {
      describe('uncontrolled open', () => {
        it('should open when the trigger is hovered', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);
        });

        it('should close when the trigger is unhovered', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.mouseLeave(trigger);

          await settle();
          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should close when the trigger is blurred', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger') as HTMLElement;

          trigger.focus();
          await tick(OPEN_DELAY);

          trigger.blur();
          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      describe('controlled open', () => {
        it('should call onOpenChange when the open state changes', async () => {
          const handleChange = vi.fn();

          function App() {
            const [open, setOpen] = createSignal(false, { ownedWrite: true });

            return (
              <TestTooltip
                rootProps={{
                  get open() {
                    return open();
                  },
                  onOpenChange: (nextOpen) => {
                    handleChange(open());
                    setOpen(nextOpen);
                  },
                }}
              />
            );
          }

          render(() => <App />);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);

          const trigger = screen.getByTestId('trigger');

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.mouseLeave(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
          expect(handleChange.mock.calls.length).toBe(2);
          expect(handleChange.mock.calls[0][0]).toBe(false);
          expect(handleChange.mock.calls[1][0]).toBe(true);
        });

        it('should not call onOpenChange when the open state does not change', async () => {
          const handleChange = vi.fn();

          function App() {
            const [open, setOpen] = createSignal(false, { ownedWrite: true });

            return (
              <TestTooltip
                rootProps={{
                  get open() {
                    return open();
                  },
                  onOpenChange: (nextOpen) => {
                    handleChange(open());
                    setOpen(nextOpen);
                  },
                }}
              />
            );
          }

          render(() => <App />);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);

          const trigger = screen.getByTestId('trigger');

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(false);
        });
      });

      describe('prop: defaultOpen', () => {
        it('should open when the component is rendered', async () => {
          render(() => <TestTooltip rootProps={{ defaultOpen: true }} />);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);
        });

        it('should not open when the component is rendered and open is controlled', async () => {
          render(() => <TestTooltip rootProps={{ defaultOpen: true, open: false }} />);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should not close when the component is rendered and open is controlled', async () => {
          render(() => <TestTooltip rootProps={{ defaultOpen: true, open: true }} />);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);
        });

        it('should remain uncontrolled', async () => {
          render(() => <TestTooltip rootProps={{ defaultOpen: true }} />);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);

          const trigger = screen.getByTestId('trigger');

          // The React test fires only `mouseleave`; the Solid hover port needs the
          // pointer to have been established as mouse-like first for the
          // safe-polygon close to run in jsdom.
          fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);
          fireEvent.mouseLeave(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      describe('prop: delay', () => {
        it('should open after rest delay', async () => {
          render(() => <TestTooltip triggerProps={{ delay: 100 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await settle();

          expect(screen.queryByText('Content')).toBe(null);

          await tick(100);

          expect(screen.queryByText('Content')).not.toBe(null);
        });
      });

      describe('prop: closeDelay', () => {
        it('should close after delay', async () => {
          render(() => <TestTooltip triggerProps={{ closeDelay: 100 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.mouseLeave(trigger);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);

          await tick(100);

          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      describe('preventUnmountOnClose()', () => {
        it('does not prevent unmounting on later closes', async () => {
          let preventNextClose = true;
          render(() => (
            <TestTooltip
              rootProps={{
                onOpenChange: (open, details) => {
                  if (!open && preventNextClose) {
                    preventNextClose = false;
                    details.preventUnmountOnClose();
                  }
                },
              }}
              triggerProps={{
                delay: 0,
                closeDelay: 0,
              }}
            />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);
          await tick(0);

          expect(screen.queryByTestId('positioner')).not.toBe(null);

          fireEvent.mouseLeave(trigger);
          await tick(0);

          // The first close is prevented from unmounting.
          expect(screen.queryByTestId('positioner')).not.toBe(null);

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);
          await tick(0);

          expect(trigger).toHaveAttribute('data-popup-open');

          fireEvent.mouseLeave(trigger);
          await tick(0);

          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });

      describe('prop: actionsRef', () => {
        it('unmounts the tooltip when the `unmount` method is called', async () => {
          const actionsRef: { current: TooltipRoot.Actions | null } = { current: null };

          render(() => (
            <TestTooltip
              rootProps={{
                actionsRef,
                onOpenChange: (open, details) => {
                  details.preventUnmountOnClose();
                },
              }}
              triggerProps={{ delay: 0, closeDelay: 0 }}
            />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect(screen.queryByTestId('positioner')).not.toBe(null);

          fireEvent.mouseLeave(trigger);
          await tick(0);

          expect(screen.queryByTestId('positioner')).not.toBe(null);

          actionsRef.current?.unmount();
          await settle();

          expect(screen.queryByTestId('positioner')).toBe(null);
        });

        it('closes the tooltip when the `close` method is called', async () => {
          const onOpenChange = vi.fn();
          const actionsRef: { current: TooltipRoot.Actions | null } = { current: null };

          render(() => (
            <TestTooltip rootProps={{ actionsRef, onOpenChange }} triggerProps={{ delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect(screen.queryByText('Content')).not.toBe(null);

          actionsRef.current?.close();
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
          expect(onOpenChange).toHaveBeenLastCalledWith(
            false,
            expect.objectContaining({ reason: REASONS.imperativeAction }),
          );
        });
      });

      describe('prop: disabled', () => {
        it('should not open when disabled', async () => {
          render(() => <TestTooltip rootProps={{ disabled: true }} triggerProps={{ delay: 0 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger') as HTMLElement;

          hoverTrigger(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);

          trigger.focus();
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should not open on focus when the trigger is disabled', async () => {
          render(() => <TestTooltip triggerProps={{ disabled: true, delay: 0 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger') as HTMLElement;

          trigger.focus();
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should close if open when becoming disabled', async () => {
          function App() {
            const [disabled, setDisabled] = createSignal(false, { ownedWrite: true });
            return (
              <div>
                <TestTooltip
                  rootProps={{
                    defaultOpen: true,
                    get disabled() {
                      return disabled();
                    },
                  }}
                  triggerProps={{ delay: 0 }}
                />
                <button
                  data-testid="disabled"
                  onClick={() => {
                    setDisabled(true);
                  }}
                />
              </div>
            );
          }

          render(() => <App />);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);

          const disabledButton = screen.getByTestId('disabled');
          fireEvent.click(disabledButton);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('does not throw error when combined with defaultOpen', async () => {
          render(() => <TestTooltip rootProps={{ defaultOpen: true, disabled: true }} />);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('marks the trigger as disabled when the root is disabled', async () => {
          render(() => <TestTooltip rootProps={{ disabled: true }} />);
          await settle();

          expect(screen.getByTestId('trigger')).toHaveAttribute('data-trigger-disabled');
        });

        it('keeps the tooltip disabled when the root is disabled and the trigger opts back in', async () => {
          render(() => (
            <TestTooltip rootProps={{ disabled: true }} triggerProps={{ disabled: false, delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');

          expect(trigger).not.toHaveAttribute('data-trigger-disabled');

          hoverTrigger(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });
      });

      describe('prop: disableHoverablePopup', () => {
        it('applies pointer-events: none to the positioner when `disableHoverablePopup = true`', async () => {
          render(() => (
            <TestTooltip rootProps={{ disableHoverablePopup: true }} triggerProps={{ delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect((screen.getByTestId('positioner') as HTMLElement).style.pointerEvents).toBe(
            'none',
          );
        });

        it('does not apply pointer-events: none to the positioner when `disableHoverablePopup = false`', async () => {
          render(() => (
            <TestTooltip rootProps={{ disableHoverablePopup: false }} triggerProps={{ delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect((screen.getByTestId('positioner') as HTMLElement).style.pointerEvents).toBe('');
        });
      });

      describe('prop: trackCursorAxis', () => {
        it('makes the positioner inert when tracking both axes', async () => {
          render(() => (
            <TestTooltip rootProps={{ trackCursorAxis: 'both' }} triggerProps={{ delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect((screen.getByTestId('positioner') as HTMLElement).style.pointerEvents).toBe(
            'none',
          );
        });

        it('keeps the positioner hoverable when tracking a single axis', async () => {
          render(() => (
            <TestTooltip rootProps={{ trackCursorAxis: 'x' }} triggerProps={{ delay: 0 }} />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await tick(0);

          expect((screen.getByTestId('positioner') as HTMLElement).style.pointerEvents).toBe('');
        });
      });

      describe('BaseUIChangeEventDetails', () => {
        it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
          render(() => (
            <TestTooltip
              rootProps={{
                onOpenChange: (nextOpen, eventDetails) => {
                  if (nextOpen) {
                    eventDetails.cancel();
                  }
                },
              }}
              triggerProps={{ delay: 0 }}
            />
          ));
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('allowPropagation() prevents stopPropagation on Escape while still closing', async () => {
          const stopPropagationSpy = vi.spyOn(Event.prototype as any, 'stopPropagation');

          render(() => (
            <TestTooltip
              rootProps={{
                defaultOpen: true,
                onOpenChange: (nextOpen, eventDetails) => {
                  if (!nextOpen && eventDetails.reason === REASONS.escapeKey) {
                    eventDetails.allowPropagation();
                  }
                },
              }}
              triggerProps={{ delay: 0 }}
            />
          ));
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.keyDown(document.body, { key: 'Escape' });
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
          expect(stopPropagationSpy).toHaveBeenCalledTimes(0);
          stopPropagationSpy.mockRestore();
        });
      });

      describe('dismissal', () => {
        it('should close when Escape is pressed', async () => {
          const onOpenChange = vi.fn();
          render(() => (
            <TestTooltip
              rootProps={{ defaultOpen: true, onOpenChange }}
              triggerProps={{ delay: 0 }}
            />
          ));
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.keyDown(document.body, { key: 'Escape' });
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
          expect(onOpenChange).toHaveBeenCalledWith(
            false,
            expect.objectContaining({ reason: REASONS.escapeKey }),
          );
        });

        it('should not open when the trigger was clicked before delay duration', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY / 2);

          fireEvent.click(trigger);

          await tick(OPEN_DELAY / 2);

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should not open when the trigger receives pointerdown before delay duration', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await tick(OPEN_DELAY / 2);

          fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

          await tick(OPEN_DELAY / 2);

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should open when the trigger was clicked before delay duration and closeOnClick is false', async () => {
          render(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY / 2);

          fireEvent.click(trigger);

          await tick(OPEN_DELAY / 2);

          expect(screen.queryByText('Content')).not.toBe(null);
        });

        it('should close when the trigger is clicked after delay duration', async () => {
          render(() => <TestTooltip />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.click(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);
        });

        it('should not close when the trigger is clicked after delay duration and closeOnClick is false', async () => {
          render(() => <TestTooltip triggerProps={{ closeOnClick: false }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(OPEN_DELAY);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.click(trigger);
          await settle();

          expect(screen.queryByText('Content')).not.toBe(null);
        });

        it('reopens on hover after the trigger is clicked closed', async () => {
          render(() => <TestTooltip triggerProps={{ delay: 100 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');

          hoverTrigger(trigger);

          await tick(100);

          expect(screen.queryByText('Content')).not.toBe(null);

          fireEvent.click(trigger);
          await settle();

          expect(screen.queryByText('Content')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be missed
          // after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await tick(100);

          expect(screen.queryByText('Content')).not.toBe(null);
        });
      });

      describe('transition status data attributes', () => {
        it('applies data-starting-style on open with animations enabled', async () => {
          (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = false;

          render(() => <TestTooltip triggerProps={{ delay: 0 }} />);
          await settle();

          const trigger = screen.getByTestId('trigger');
          hoverTrigger(trigger);
          flush();

          const popup = screen.getByTestId('popup');
          expect(popup).toHaveAttribute('data-starting-style');
          expect(popup).toHaveAttribute('data-open');
        });
      });
    },
  );

  describe('aria attributes', () => {
    it('does not add an aria-describedby attribute to the trigger (handled by the popup)', async () => {
      render(() => <ContainedTriggerTooltip rootProps={{ defaultOpen: true }} />);
      await settle();

      // The current implementation does not wire aria-describedby on the trigger.
      expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-describedby');
    });
  });
});
