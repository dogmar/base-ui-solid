/* eslint-disable react/jsx-fragments */
import { beforeEach, describe, expect, it } from 'vitest';
import { createSignal, flush, For, Show } from 'solid-js';
import { Portal } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { Toast } from '..';
import type { ToastRoot as ToastRootNamespace } from './ToastRoot';
import { List, Button } from '../utils/test-utils';
import { toastRootStateAttributesMapping } from './ToastRoot';

const toast: ToastRootNamespace.ToastObject = {
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

function simulateSwipe(
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  releaseTarget: HTMLElement | Document = element,
  releaseType: 'pointerup' | 'pointercancel' = 'pointerup',
) {
  fireEvent.pointerDown(element, {
    clientX: startX,
    clientY: startY,
    button: 0,
    bubbles: true,
    pointerId: 1,
  });

  // Fire an initial move event close to the start to trigger the first-pointer-move logic
  // correctly. This simulates the finger moving slightly before the main swipe movement is
  // registered.
  let deltaX = 0;
  if (endX > startX) {
    deltaX = 1;
  } else if (endX < startX) {
    deltaX = -1;
  }

  let deltaY = 0;
  if (endY > startY) {
    deltaY = 1;
  } else if (endY < startY) {
    deltaY = -1;
  }

  fireEvent.pointerMove(element, {
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    bubbles: true,
    pointerId: 1,
  });

  // Fire the main move event to the end position.
  fireEvent.pointerMove(element, {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  });
  const releaseEvent = {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  };

  if (releaseType === 'pointercancel') {
    fireEvent.pointerCancel(releaseTarget, releaseEvent);
  } else {
    fireEvent.pointerUp(releaseTarget, releaseEvent);
  }
}

describe('<Toast.Root />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('maps the active swipe direction to its data attribute', () => {
    expect(toastRootStateAttributesMapping.swipeDirection!('left')).toEqual({
      'data-swipe-direction': 'left',
    });
  });

  it('sets the vertical offset CSS variable', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    await click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByTestId('root').style.getPropertyValue('--toast-offset-y')).not.toBe('');
  });

  it('keeps dynamic title and description ids synchronized with mounted label parts', async () => {
    function App() {
      const [mode, setMode] = createSignal<'fallback' | 'explicit' | 'none' | 'restored'>(
        'fallback',
      );
      const showLabels = () => mode() !== 'none';
      const explicit = () => mode() === 'explicit';

      return (
        <Toast.Provider>
          <button type="button" onClick={() => setMode('explicit')}>
            explicit
          </button>
          <button type="button" onClick={() => setMode('none')}>
            none
          </button>
          <button type="button" onClick={() => setMode('restored')}>
            restore
          </button>
          <Toast.Viewport>
            <Toast.Root toast={{ ...toast, description: 'Toast description' }} data-testid="root">
              <Show when={showLabels()}>
                <Toast.Title data-testid="title">
                  {explicit() ? 'Explicit title' : undefined}
                </Toast.Title>
                <Toast.Description data-testid="description">
                  {explicit() ? 'Explicit description' : undefined}
                </Toast.Description>
              </Show>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      );
    }

    render(() => <App />);
    await settle();

    const root = screen.getByTestId('root');

    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);

    await click(screen.getByRole('button', { name: 'explicit' }));
    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
    expect(screen.getByTestId('title')).toHaveTextContent('Explicit title');
    expect(screen.getByTestId('description')).toHaveTextContent('Explicit description');

    await click(screen.getByRole('button', { name: 'none' }));
    expect(root).not.toHaveAttribute('aria-labelledby');
    expect(root).not.toHaveAttribute('aria-describedby');

    await click(screen.getByRole('button', { name: 'restore' }));
    expect(root).toHaveAttribute('aria-labelledby', screen.getByTestId('title').id);
    expect(root).toHaveAttribute('aria-describedby', screen.getByTestId('description').id);
    expect(screen.getByTestId('title')).toHaveTextContent('Toast title');
    expect(screen.getByTestId('description')).toHaveTextContent('Toast description');
  });

  it('ignores Escape when focus is in portaled content', async () => {
    function PortalList() {
      const manager = Toast.useToastManager();
      return (
        <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
          {(toastItem) => (
            <Toast.Root toast={toastItem()} data-testid="root">
              <Toast.Title>{toastItem().title}</Toast.Title>
              <Portal mount={document.body}>
                <button type="button" data-testid="portaled">
                  portaled
                </button>
              </Portal>
            </Toast.Root>
          )}
        </For>
      );
    }

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <PortalList />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    await click(screen.getByRole('button', { name: 'add' }));

    // The button is a logical child of the toast, but it lives outside the
    // toast in the DOM and owns the Escape key.
    const portaled = screen.getByTestId('portaled');
    portaled.focus();
    await settle();
    fireEvent.keyDown(portaled, { key: 'Escape' });
    await settle();

    expect(screen.queryByTestId('root')).not.toBe(null);
  });

  // The React suite's chromium-only tests (`it.skipIf(isJSDOM)`): height
  // recalculation on content mutation, restoring height when re-adding an
  // ending toast, re-registering remounted roots, stacking after re-adding,
  // clearing swipe state on re-add/reuse, index-keyed focus hand-off, Escape
  // with :focus-visible, and the real-pointer swipe suite all require layout
  // measurements or real gesture timing and are not ported to the jsdom run.

  describe('drag behavior regression', () => {
    function DragList() {
      const manager = Toast.useToastManager();
      return (
        <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
          {(toastItem) => (
            <Toast.Root toast={toastItem()} data-testid="toast-root">
              <Toast.Content data-testid="toast-content">
                <Toast.Title>{toastItem().title}</Toast.Title>
                <Toast.Description>{toastItem().description}</Toast.Description>
              </Toast.Content>
            </Toast.Root>
          )}
        </For>
      );
    }

    function DragButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() => {
            add({ title: 'T', description: 'D' });
          }}
        >
          add toast
        </button>
      );
    }

    it('resets drag state after releasing a far swipe even when the release lands on the document', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>
      ));
      await settle();

      await click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Default swipeDirection=['down','right']. Dragging left triggers the damped, opposite-
      // direction path. Release on the document to cover browsers that don't deliver the final
      // pointer event back to the toast root.
      simulateSwipe(toastElement, 300, 100, -5000, 100, document);
      await settle();

      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');

      simulateSwipe(toastElement, 100, 100, 150, 100);
      await settle();

      await waitFor(() => {
        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('resets drag state after a document pointercancel', async () => {
      render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>
      ));
      await settle();

      await click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      simulateSwipe(toastElement, 300, 100, -5000, 100, document, 'pointercancel');
      await settle();

      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');
    });
  });

  describe('object identity', () => {
    // Regression test for https://github.com/mui/base-ui/issues/3922
    // Toast calculations should use ID-based lookups, not referential equality
    it('works correctly when toast objects are recreated (not referentially equal)', async () => {
      // This component creates NEW toast objects by spreading them. This is a
      // common pattern when users want to add type-safety to the data field or
      // transform toast properties.
      function ToastListWithNewObjects() {
        const manager = Toast.useToastManager();

        return (
          <For
            each={manager.toasts.map((t) => ({ ...t }))}
            keyed={(toastItem) => toastItem.id}
          >
            {(toastItem) => (
              <Toast.Root toast={toastItem()} data-testid="toast-root">
                <Toast.Title>{toastItem().title}</Toast.Title>
                <Toast.Description>{toastItem().description}</Toast.Description>
                <Toast.Close data-testid="toast-close">Close</Toast.Close>
              </Toast.Root>
            )}
          </For>
        );
      }

      function AddButton() {
        const { add } = Toast.useToastManager();
        return (
          <button
            type="button"
            onClick={() => {
              add({
                id: 'test-toast',
                title: 'Test Title',
                description: 'Test Description',
              });
            }}
          >
            add toast
          </button>
        );
      }

      render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));
      await settle();

      await click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Verify the toast index is correctly calculated (should be 0, not -1)
      // The --toast-index CSS variable is set based on the domIndex calculation
      expect(toastElement.style.getPropertyValue('--toast-index')).toBe('0');

      // Verify the close button works (which also relies on ID-based lookup)
      await click(screen.getByTestId('toast-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('correctly calculates indices for multiple toasts with recreated objects', async () => {
      function ToastListWithNewObjects() {
        const manager = Toast.useToastManager();

        return (
          <For
            each={manager.toasts.map((t) => ({ ...t }))}
            keyed={(toastItem) => toastItem.id}
          >
            {(toastItem) => (
              <Toast.Root toast={toastItem()} data-testid={`toast-${toastItem().id}`}>
                <Toast.Title>{toastItem().title}</Toast.Title>
              </Toast.Root>
            )}
          </For>
        );
      }

      function AddButton() {
        const { add } = Toast.useToastManager();
        return (
          <button
            type="button"
            onClick={() => {
              add({ title: 'Toast 1' });
              add({ title: 'Toast 2' });
              add({ title: 'Toast 3' });
            }}
          >
            add toasts
          </button>
        );
      }

      render(() => (
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>
      ));
      await settle();

      await click(screen.getByRole('button', { name: 'add toasts' }));

      const toasts = await screen.findAllByTestId(/^toast-/);
      expect(toasts).toHaveLength(3);

      toasts.forEach((toastEl) => {
        const toastIndex = parseInt(toastEl.style.getPropertyValue('--toast-index'), 10);
        expect(toastIndex).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
