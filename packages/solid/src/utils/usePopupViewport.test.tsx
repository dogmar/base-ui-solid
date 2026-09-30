import { flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, waitFor } from '@solidjs/testing-library';
import { Store } from '../solid-utils/store';
import { usePopupViewport } from './usePopupViewport';
import { adaptiveOrigin } from './adaptiveOriginMiddleware';

interface TestState {
  activeTriggerElement: Element | null;
  activeTriggerId: string | null;
  open: boolean;
  payload: unknown;
  mounted: boolean;
  popupElement: HTMLElement | null;
  positionerElement: HTMLElement | null;
  adaptiveOrigin: unknown;
}

function createTestStore() {
  return new Store<TestState>({
    activeTriggerElement: null,
    activeTriggerId: null,
    open: false,
    payload: undefined,
    mounted: false,
    popupElement: null,
    positionerElement: null,
    adaptiveOrigin: undefined,
  });
}

function Viewport(props: { store: Store<TestState>; children?: JSX.Element | undefined }) {
  const { children, state } = usePopupViewport({
    store: props.store,
    get side() {
      return 'bottom' as const;
    },
    get children() {
      return props.children;
    },
  });

  return (
    <div
      data-testid="viewport"
      data-transitioning={state.transitioning ? '' : undefined}
      data-activation-direction={state.activationDirection}
    >
      {children}
    </div>
  );
}

describe('usePopupViewport', () => {
  it('renders children inside the current container', () => {
    const store = createTestStore();
    const { getByTestId } = render(() => (
      <Viewport store={store}>
        <span data-testid="content">A</span>
      </Viewport>
    ));

    const content = getByTestId('content');
    const current = content.parentElement as HTMLElement;
    expect(current).toHaveAttribute('data-current');
    expect(getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
  });

  it('registers the adaptive origin middleware for its lifetime', () => {
    const store = createTestStore();
    const { unmount } = render(() => <Viewport store={store} />);

    expect(store.state.adaptiveOrigin).toBe(adaptiveOrigin);

    unmount();
    expect(store.state.adaptiveOrigin).toBeUndefined();
  });

  it('snapshots the previous content and remounts the current container on trigger changes', async () => {
    const store = createTestStore();
    const trigger1 = document.createElement('button');
    const trigger2 = document.createElement('button');

    const { getByTestId } = render(() => (
      <Viewport store={store}>
        <span data-testid="content">A</span>
      </Viewport>
    ));

    store.update({
      open: true,
      mounted: true,
      activeTriggerElement: trigger1,
      activeTriggerId: 't1',
    });
    flush();
    // Drain the effect cascade (content key bump, capture).
    flush();
    await Promise.resolve();
    flush();

    const viewport = getByTestId('viewport');
    const firstContainer = getByTestId('content').parentElement as HTMLElement;
    expect(viewport.querySelector('[data-previous]')).toBeNull();

    store.update({ activeTriggerElement: trigger2, activeTriggerId: 't2' });
    flush();
    flush();

    // The previous container mounts with the snapshotted content while transitioning.
    expect(viewport).toHaveAttribute('data-transitioning');
    const previousContainer = viewport.querySelector('[data-previous]') as HTMLElement;
    expect(previousContainer).not.toBeNull();
    await waitFor(() => {
      expect(previousContainer.textContent).toBe('A');
    });

    // The current container is remounted (new DOM subtree) for the new trigger.
    const secondContainer = viewport.querySelector('[data-current]') as HTMLElement;
    expect(secondContainer.querySelector('[data-testid="content"]')).not.toBeNull();
    expect(secondContainer).not.toBe(firstContainer);

    // Without animations (jsdom), the transition cleans itself up.
    await waitFor(() => {
      expect(getByTestId('viewport')).not.toHaveAttribute('data-transitioning');
    });
    expect(viewport.querySelector('[data-previous]')).toBeNull();
  });
});
