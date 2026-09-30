/* eslint-disable react/jsx-fragments */
import { beforeEach, describe, expect, it } from 'vitest';
import { createSignal, flush, For } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';

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

describe('<Toast.Content />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  function App() {
    const manager = Toast.useToastManager();
    const [count, setCount] = createSignal(0);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            const next = count() + 1;
            setCount(next);
            manager.add({ title: `toast-${next}` });
          }}
        >
          add
        </button>
        <Toast.Viewport data-testid="viewport">
          <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
            {(toastItem) => (
              <Toast.Root toast={toastItem()}>
                <Toast.Content data-testid={`content-${toastItem().title}`}>
                  <Toast.Title />
                </Toast.Content>
              </Toast.Root>
            )}
          </For>
        </Toast.Viewport>
      </>
    );
  }

  it('marks content behind the frontmost toast with data-behind', async () => {
    render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));
    await settle();

    const addButton = screen.getByRole('button', { name: 'add' });
    await click(addButton);
    await click(addButton);

    // The newest toast is at the front; the older one sits behind it.
    expect(screen.getByTestId('content-toast-2')).not.toHaveAttribute('data-behind');
    expect(screen.getByTestId('content-toast-1')).toHaveAttribute('data-behind');
  });

  it('reflects the expanded state when the viewport is hovered', async () => {
    render(() => (
      <Toast.Provider>
        <App />
      </Toast.Provider>
    ));
    await settle();

    await click(screen.getByRole('button', { name: 'add' }));

    const content = screen.getByTestId('content-toast-1');
    expect(content).not.toHaveAttribute('data-expanded');

    fireEvent.mouseEnter(screen.getByTestId('viewport'));
    await settle();
    expect(content).toHaveAttribute('data-expanded');
  });
});
