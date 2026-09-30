/* eslint-disable react/jsx-fragments */
import { vi, expect, describe, test, it, beforeEach } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';

import { isJSDOM } from '#test-utils';
import { useFloating } from '../hooks/useFloating';
import { useHover } from '../hooks/useHover';
import { FloatingDelayGroup, useDelayGroup } from './FloatingDelayGroup';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

interface Props {
  label: string;
  testid: string;
}

function Tooltip(props: Props): JSX.Element {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });

  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });

  const { delayRef, isInstantPhase } = useDelayGroup(context, {
    get open() {
      return open();
    },
  });
  const hover = useHover(context, { delay: () => delayRef.current });

  return (
    <>
      <button
        data-testid={props.testid}
        data-instant-phase={isInstantPhase() ? '' : undefined}
        ref={refs.setReference}
        {...hover.reference}
      />
      <Show when={open()}>
        <div data-testid={`floating-${props.label}`} ref={refs.setFloating}>
          {props.label}
        </div>
      </Show>
    </>
  );
}

function App(): JSX.Element {
  return (
    <FloatingDelayGroup delay={{ open: 1000, close: 200 }}>
      <Tooltip label="one" testid="reference-one" />
      <Tooltip label="two" testid="reference-two" />
      <Tooltip label="three" testid="reference-three" />
    </FloatingDelayGroup>
  );
}

describe.skipIf(!isJSDOM)('FloatingDelayGroup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('groups delays correctly', async () => {
    render(() => <App />);
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    vi.advanceTimersByTime(999);
    await settle();

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    vi.advanceTimersByTime(199);
    await settle();

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  test('timeoutMs', async () => {
    function TimeoutApp() {
      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one" testid="reference-one" />
          <Tooltip label="two" testid="reference-two" />
          <Tooltip label="three" testid="reference-three" />
        </FloatingDelayGroup>
      );
    }

    render(() => <TimeoutApp />);
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    vi.advanceTimersByTime(1000);
    await settle();

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));
    await settle();

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    vi.advanceTimersByTime(499);
    await settle();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    vi.advanceTimersByTime(99);
    await settle();

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  it('resets the instant phase after the group timeout elapses', async () => {
    render(() => (
      <FloatingDelayGroup delay={{ open: 1000, close: 0 }} timeoutMs={50}>
        <Tooltip label="one" testid="reference-one" />
        <Tooltip label="two" testid="reference-two" />
      </FloatingDelayGroup>
    ));
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));
    vi.advanceTimersByTime(1000);
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));
    vi.advanceTimersByTime(1);
    await settle();

    const secondReference = screen.getByTestId('reference-two');
    expect(secondReference).toHaveAttribute('data-instant-phase');

    fireEvent.mouseLeave(secondReference);
    vi.advanceTimersByTime(50);
    await settle();

    expect(secondReference).not.toHaveAttribute('data-instant-phase');
  });

  it('keeps the active context when an inactive consumer unmounts', async () => {
    function Test() {
      const [showSecond, setShowSecond] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one" testid="reference-one" />
          <Show when={showSecond()}>
            <Tooltip label="two" testid="reference-two" />
          </Show>
          <Tooltip label="three" testid="reference-three" />
          <button type="button" onClick={() => setShowSecond(false)}>
            Remove inactive
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    vi.advanceTimersByTime(1000);
    await settle();

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove inactive' }));
    await settle();
    expect(screen.queryByTestId('reference-two')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();
  });

  it('keeps the timeout active when the last closed consumer unmounts', async () => {
    function Test() {
      const [showFirst, setShowFirst] = createSignal(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Show when={showFirst()}>
            <Tooltip label="one" testid="reference-one" />
          </Show>
          <Tooltip label="two" testid="reference-two" />
          <button type="button" onClick={() => setShowFirst(false)}>
            Remove closed
          </button>
        </FloatingDelayGroup>
      );
    }

    render(() => <Test />);
    await settle();

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    vi.advanceTimersByTime(1000);
    await settle();

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    vi.advanceTimersByTime(100);
    await settle();

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove closed' }));
    await settle();
    expect(screen.queryByTestId('reference-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    vi.advanceTimersByTime(1);
    await settle();

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
  });
});
