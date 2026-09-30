import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';

import { mergePropsN } from '../../merge-props';
import { useFloating } from '../index';
import { useFocus } from './useFocus';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function App(props: { delay?: number }) {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: (o) => setOpen(o),
  });
  const focus = useFocus(context, {
    get delay() {
      return props.delay;
    },
  });

  return (
    <>
      <button {...mergePropsN([focus.reference])} ref={refs.setReference} />
      <Show when={open()}>
        {(_) => {
          onCleanup(() => refs.setFloating(null));
          return <div role="tooltip" ref={refs.setFloating} />;
        }}
      </Show>
    </>
  );
}

describe('useFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('opens on focus and closes on blur', async () => {
    render(() => <App />);
    await settle();
    const button = screen.getByRole('button');

    button.focus();
    await settle();

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    button.blur();
    vi.advanceTimersByTime(0);
    await settle();

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('does not reopen when focus is restored after leaving the tab', async () => {
    render(() => <App delay={100} />);
    await settle();
    const button = screen.getByRole('button');

    button.focus();
    await settle();

    window.dispatchEvent(new Event('blur'));
    fireEvent.focusIn(button);

    vi.advanceTimersByTime(200);
    await settle();

    expect(screen.queryByRole('tooltip')).toBe(null);
  });
});
