/* eslint-disable react/jsx-fragments */
import { vi, test, expect, describe, beforeEach } from 'vitest';
import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import type { ElementProps } from '../types';
import { useFloating } from './useFloating';
import { useHover, type UseHoverProps } from './useHover';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function Reference(props: {
  setReference: (node: Element | null) => void;
  hoverProps: ElementProps['reference'];
}) {
  // Solid does not invoke refs with `null` on unmount, so release the
  // reference from the component scope (never from the ref callback itself).
  onCleanup(() => props.setReference(null));
  return <button ref={(el: Element) => props.setReference(el)} {...props.hoverProps} />;
}

function App(props: UseHoverProps & { showReference?: boolean }) {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });
  const hover = useHover(context, props);

  return (
    <>
      <Show when={props.showReference ?? true}>
        <Reference setReference={refs.setReference} hoverProps={hover.reference} />
      </Show>
      <Show when={open()}>
        <div role="tooltip" ref={refs.setFloating} />
      </Show>
    </>
  );
}

describe.skipIf(!isJSDOM)('useHover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('opens on mouseenter', async () => {
    render(() => <App />);
    await settle();

    fireEvent.mouseEnter(screen.getByRole('button'));
    await settle();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('closes on mouseleave', async () => {
    render(() => <App />);
    await settle();

    fireEvent.mouseEnter(screen.getByRole('button'));
    await settle();
    fireEvent.mouseLeave(screen.getByRole('button'));
    await settle();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  describe('prop: delay', () => {
    test('symmetric number', async () => {
      render(() => <App delay={1000} />);
      await settle();

      fireEvent.mouseEnter(screen.getByRole('button'));

      vi.advanceTimersByTime(999);
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      vi.advanceTimersByTime(1);
      await settle();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('open', async () => {
      render(() => <App delay={{ open: 500 }} />);
      await settle();

      fireEvent.mouseEnter(screen.getByRole('button'));

      vi.advanceTimersByTime(499);
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      vi.advanceTimersByTime(1);
      await settle();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('close', async () => {
      render(() => <App delay={{ close: 500 }} />);
      await settle();

      fireEvent.mouseEnter(screen.getByRole('button'));
      await settle();
      fireEvent.mouseLeave(screen.getByRole('button'));

      vi.advanceTimersByTime(499);
      await settle();

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      vi.advanceTimersByTime(1);
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('open with close 0', async () => {
      render(() => <App delay={{ open: 500 }} />);
      await settle();

      fireEvent.mouseEnter(screen.getByRole('button'));

      vi.advanceTimersByTime(499);
      await settle();

      fireEvent.mouseLeave(screen.getByRole('button'));

      vi.advanceTimersByTime(1);
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('restMs + nullish open delay should respect restMs', async () => {
      render(() => <App restMs={100} delay={{ close: 100 }} />);
      await settle();

      fireEvent.mouseEnter(screen.getByRole('button'));

      vi.advanceTimersByTime(99);
      await settle();

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('restMs', async () => {
    render(() => <App restMs={100} />);
    await settle();

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 10 });
      Object.defineProperty(event, 'movementY', { value: 10 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    vi.advanceTimersByTime(99);
    await settle();

    fireEvent.mouseMove(button);

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseMove(button);

    vi.advanceTimersByTime(100);
    await settle();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test('restMs does not reset timer for minor mouse movement', async () => {
    render(() => <App restMs={100} />);
    await settle();

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 1 });
      Object.defineProperty(event, 'movementY', { value: 0 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    vi.advanceTimersByTime(99);
    await settle();

    fireEvent.mouseMove(button);

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test('mouseleave on the floating element closes it (mouse)', async () => {
    render(() => <App />);
    await settle();

    fireEvent.mouseEnter(screen.getByRole('button'));
    await settle();

    fireEvent(
      screen.getByRole('button'),
      new MouseEvent('mouseleave', {
        relatedTarget: screen.getByRole('tooltip'),
      }),
    );
    await settle();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('does not show after delay if domReference changes', async () => {
    const [showReference, setShowReference] = createSignal(true);
    render(() => <App delay={1000} showReference={showReference()} />);
    await settle();

    fireEvent.mouseEnter(screen.getByRole('button'));

    vi.advanceTimersByTime(1);
    await settle();

    setShowReference(false);
    await settle();

    vi.advanceTimersByTime(999);
    await settle();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('reason string', async () => {
    function ReasonApp() {
      const [isOpen, setIsOpen] = createSignal(false, { ownedWrite: true });
      const { refs, context } = useFloating({
        get open() {
          return isOpen();
        },
        onOpenChange(nextOpen, data) {
          setIsOpen(nextOpen);
          expect(data?.reason).toBe(REASONS.triggerHover);
        },
      });

      const hover = useHover(context);

      return (
        <>
          <button ref={refs.setReference} {...hover.reference} />
          <Show when={isOpen()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <ReasonApp />);
    await settle();

    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    await settle();
    fireEvent.mouseLeave(button);
    await settle();
  });

  test('does not reopen from a mousemove over a child of the active trigger while open', async () => {
    const onOpenChange = vi.fn();

    function ChildApp() {
      const [open, setOpen] = createSignal(true, { ownedWrite: true });
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });
      const hover = useHover(context);

      return (
        <>
          <button ref={refs.setReference} {...hover.reference}>
            <span data-testid="child" />
          </button>
          <Show when={open()}>
            <div role="tooltip" ref={refs.setFloating} />
          </Show>
        </>
      );
    }

    render(() => <ChildApp />);
    await settle();

    const child = screen.getByTestId('child');
    const event = new MouseEvent('mousemove', { bubbles: true });

    // Deliberately skew the composed path so shadow DOM-safe target resolution
    // would land outside the trigger, while the event target remains `child`.
    Object.defineProperty(event, 'composedPath', {
      configurable: true,
      value: () => [document.body, child.parentElement, child],
    });

    fireEvent(child, event);
    await settle();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });
});
