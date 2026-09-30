/* eslint-disable react/jsx-fragments */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush, For } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';
import type { ToastRoot } from '../root/ToastRoot';
import type { ToastManagerAddOptions } from '../useToastManager';

const toast: ToastRoot.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

async function click(element: Element) {
  fireEvent.click(element);
  await settle();
}

function AnchoredList() {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
      {(toastItem) => (
        <Toast.Positioner toast={toastItem()} data-testid={toastItem().id}>
          <Toast.Root toast={toastItem()}>
            <Toast.Title />
          </Toast.Root>
        </Toast.Positioner>
      )}
    </For>
  );
}

function AddButton(props: { options?: Partial<ToastManagerAddOptions<any>> }) {
  const { add } = Toast.useToastManager();
  return (
    <button type="button" onClick={() => add({ title: 'title', ...props.options })}>
      add
    </button>
  );
}

describe('<Toast.Positioner />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // The React suite's `positions an anchored toast against its anchor element`
  // test requires real layout measurements and is not ported to the jsdom run.

  it('falls back to the viewport when no anchor is provided', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <AnchoredList />
        </Toast.Viewport>
        <AddButton options={{ id: 'unanchored' }} />
      </Toast.Provider>
    ));
    await settle();

    await click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('unanchored');
    // An unanchored positioner still renders, with the defaults applied.
    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner).toHaveAttribute('data-align', 'center');
    expect(positioner).toHaveTextContent('title');
  });

  it('lets positioner props override the ones carried on the toast', async () => {
    function OverridingList() {
      const manager = Toast.useToastManager();
      return (
        <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
          {(toastItem) => (
            <Toast.Positioner toast={toastItem()} data-testid="positioner" side="left">
              <Toast.Root toast={toastItem()}>
                <Toast.Title />
              </Toast.Root>
            </Toast.Positioner>
          )}
        </For>
      );
    }

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <OverridingList />
        </Toast.Viewport>
        <AddButton options={{ positionerProps: { side: 'bottom', align: 'end' } }} />
      </Toast.Provider>
    ));
    await settle();

    await click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'left');
    // Props not set on the element still come from the toast.
    expect(positioner).toHaveAttribute('data-align', 'end');
  });

  describe('--toast-index', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the DOM index while a toast animates out', async () => {
      const manager = Toast.createToastManager();

      render(() => (
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </Toast.Provider>
      ));
      await settle();

      manager.add({ id: 'oldest', title: 'oldest' });
      await settle();
      manager.add({ id: 'newest', title: 'newest' });
      await settle();

      const newest = screen.getByTestId('newest');
      const oldest = screen.getByTestId('oldest');

      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('1');

      // Keep the closing toast mounted (`ending`) so its index can be read.
      (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = false;
      manager.close('newest');
      flush();

      // The closing toast is excluded from the visible stack, but it must keep a
      // real index while it animates out rather than collapsing to `-1`.
      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('0');
    });
  });

  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => {
        render(() => <Toast.Positioner toast={toast} />);
      }).toThrow('Base UI: useToastManager must be used within <Toast.Provider>.');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
