import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderEffect, createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { Toast } from '..';
import { useToastProviderContext } from './ToastProviderContext';

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

describe('<Toast.Provider />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs a changed timeout before descendant layout effects', async () => {
    const onClose = vi.fn();

    function AddToastInLayoutEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'toast', title: 'Toast', onClose });
          }
        },
      );

      return null;
    }

    const [timeout, setTimeoutProp] = createSignal(5000);
    const [addToast, setAddToast] = createSignal(false);

    function App() {
      return (
        <Toast.Provider timeout={timeout()}>
          <AddToastInLayoutEffect active={addToast()} />
        </Toast.Provider>
      );
    }

    render(() => <App />);
    await settle();

    setTimeoutProp(1000);
    setAddToast(true);
    await settle();

    await tick(999);
    expect(onClose).not.toHaveBeenCalled();

    await tick(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('syncs a changed limit before descendant layout effects', async () => {
    const observeToasts = vi.fn();

    function AddToastsInLayoutEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'first', title: 'First', timeout: 0 });
            add({ id: 'second', title: 'Second', timeout: 0 });
          }
        },
      );

      return null;
    }

    function ObserveToastsInLayoutEffect(props: { active: boolean }) {
      const store = useToastProviderContext();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            observeToasts(
              store.state.toasts.map((toast) => ({
                id: toast.id,
                limited: toast.limited,
              })),
            );
          }
        },
      );

      return null;
    }

    const [limit, setLimit] = createSignal(3);
    const [runEffects, setRunEffects] = createSignal(false);

    function App() {
      return (
        <Toast.Provider limit={limit()}>
          <AddToastsInLayoutEffect active={runEffects()} />
          <ObserveToastsInLayoutEffect active={runEffects()} />
        </Toast.Provider>
      );
    }

    render(() => <App />);
    await settle();

    setLimit(1);
    setRunEffects(true);
    await settle();

    expect(observeToasts).toHaveBeenCalledWith([
      { id: 'second', limited: false },
      { id: 'first', limited: true },
    ]);
  });

  // The React suite's `does not sync provider props from an abandoned render`
  // test exercises React Suspense/transition semantics and has no Solid
  // equivalent.
});
