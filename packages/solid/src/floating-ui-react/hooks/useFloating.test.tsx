import { expect, test, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { render, waitFor } from '@solidjs/testing-library';
import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStore';
import { autoUpdate } from '../index';
import type { UseFloatingReturn, VirtualElement } from '../types';
import { useBaseUIFloating, useFloating } from './useFloating';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function createRootStore(floatingElement: HTMLElement) {
  return new FloatingRootStore({
    open: true,
    transitionStatus: undefined,
    referenceElement: document.createElement('button'),
    floatingElement,
    triggerElements: new PopupTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

function BaseUITest(props: {
  rootContext: FloatingRootStore;
  onRender(value: UseFloatingReturn): void;
}) {
  const floating = useBaseUIFloating({ rootContext: props.rootContext });
  props.onRender(floating);

  return (
    <>
      <button data-testid="reference" ref={floating.refs.setReference} />
      <div data-testid="floating" ref={floating.refs.setFloating} />
    </>
  );
}

test('uses the supplied root store while preserving DOM and position references', async () => {
  const store = createRootStore(document.createElement('div'));
  let floating: UseFloatingReturn | undefined;

  const { getByTestId } = render(() => (
    <BaseUITest
      rootContext={store}
      onRender={(value) => {
        floating = value;
      }}
    />
  ));
  await settle();

  const referenceElement = getByTestId('reference');
  const floatingElement = getByTestId('floating');

  expect(floating?.refs.floating.current).toBe(floatingElement);
  expect(floating?.context.rootStore).toBe(store);
  expect(floating?.context.dataRef).toBe(store.context.dataRef);
  expect(floating?.context.events).toBe(store.context.events);

  expect(store.state.referenceElement).toBe(referenceElement);
  expect(store.state.domReferenceElement).toBe(referenceElement);
  expect(store.state.floatingElement).toBe(floatingElement);

  const positionReference: VirtualElement = {
    getBoundingClientRect: () => new DOMRect(1, 2, 3, 4),
  };

  floating?.refs.setPositionReference(positionReference);
  await settle();

  expect(floating?.refs.reference.current).toBe(positionReference);
  expect(floating?.elements.reference()).toBe(positionReference);
  expect(store.state.referenceElement).toBe(referenceElement);
  expect(store.state.domReferenceElement).toBe(referenceElement);
  expect(floating?.refs.domReference.current).toBe(referenceElement);
});

test('syncs the floating context into the root store dataRef', async () => {
  const store = createRootStore(document.createElement('div'));
  let floating: UseFloatingReturn | undefined;

  render(() => (
    <BaseUITest
      rootContext={store}
      onRender={(value) => {
        floating = value;
      }}
    />
  ));
  await settle();

  expect(store.context.dataRef.current.floatingContext).toBe(floating?.context);
});

function mockRect(element: Element, rect: Partial<DOMRect>) {
  const fullRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: rect.y ?? 0,
    left: rect.x ?? 0,
    right: (rect.x ?? 0) + (rect.width ?? 0),
    bottom: (rect.y ?? 0) + (rect.height ?? 0),
    ...rect,
  };
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => fullRect as DOMRect);
}

test('positions the floating element from mocked rects', async () => {
  let floating: UseFloatingReturn | undefined;

  function App() {
    floating = useFloating({ open: true });
    return (
      <>
        <button
          data-testid="reference"
          ref={(el: Element) => {
            mockRect(el, { x: 50, y: 50, width: 100, height: 20 });
            floating!.refs.setReference(el);
          }}
        />
        <div
          data-testid="floating"
          ref={(el: HTMLElement) => {
            mockRect(el, { x: 0, y: 0, width: 0, height: 0 });
            floating!.refs.setFloating(el);
          }}
        />
      </>
    );
  }

  render(() => <App />);
  await settle();

  await waitFor(() => {
    expect(floating!.isPositioned()).toBe(true);
  });

  // Default placement `bottom`: x = 50 + 100 / 2 - 0 / 2, y = 50 + 20.
  expect(floating!.x()).toBe(100);
  expect(floating!.y()).toBe(70);
  expect(floating!.placement()).toBe('bottom');
  expect(floating!.strategy()).toBe('absolute');
  expect(floating!.floatingStyles()).toMatchObject({
    position: 'absolute',
    transform: 'translate(100px, 70px)',
  });
});

test('floatingStyles uses top/left when transform is disabled', async () => {
  let floating: UseFloatingReturn | undefined;

  function App() {
    floating = useFloating({ open: true, transform: false });
    return (
      <>
        <button
          ref={(el: Element) => {
            mockRect(el, { x: 10, y: 10, width: 20, height: 10 });
            floating!.refs.setReference(el);
          }}
        />
        <div
          ref={(el: HTMLElement) => {
            floating!.refs.setFloating(el);
          }}
        />
      </>
    );
  }

  render(() => <App />);
  await settle();

  await waitFor(() => {
    expect(floating!.isPositioned()).toBe(true);
  });

  expect(floating!.floatingStyles()).toMatchObject({
    position: 'absolute',
    left: '20px',
    top: '20px',
  });
});

test('calls whileElementsMounted with both elements and cleans up on unmount', async () => {
  const cleanup = vi.fn();
  const whileElementsMounted = vi.fn(() => cleanup);
  let floating: UseFloatingReturn | undefined;

  function App() {
    floating = useFloating({ open: true, whileElementsMounted });
    return (
      <>
        <button data-testid="reference" ref={floating.refs.setReference} />
        <div data-testid="floating" ref={floating.refs.setFloating} />
      </>
    );
  }

  const { getByTestId, unmount } = render(() => <App />);
  await settle();

  expect(whileElementsMounted).toHaveBeenCalledTimes(1);
  expect(whileElementsMounted).toHaveBeenCalledWith(
    getByTestId('reference'),
    getByTestId('floating'),
    expect.any(Function),
  );
  expect(cleanup).not.toHaveBeenCalled();

  unmount();
  flush();

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test('supports autoUpdate as whileElementsMounted', async () => {
  let floating: UseFloatingReturn | undefined;

  function App() {
    floating = useFloating({ open: true, whileElementsMounted: autoUpdate });
    return (
      <>
        <button ref={floating.refs.setReference} />
        <div ref={floating.refs.setFloating} />
      </>
    );
  }

  const { unmount } = render(() => <App />);
  await settle();

  await waitFor(() => {
    expect(floating!.isPositioned()).toBe(true);
  });

  unmount();
});

test('resets isPositioned when open becomes false', async () => {
  const [open, setOpen] = createSignal(true);
  let floating: UseFloatingReturn | undefined;

  function App() {
    floating = useFloating({
      get open() {
        return open();
      },
    });
    return (
      <>
        <button ref={floating.refs.setReference} />
        <div ref={floating.refs.setFloating} />
      </>
    );
  }

  render(() => <App />);
  await settle();

  await waitFor(() => {
    expect(floating!.isPositioned()).toBe(true);
  });

  setOpen(false);
  await settle();

  expect(floating!.isPositioned()).toBe(false);
});

test('open state from the root context is exposed as a reactive accessor', async () => {
  const store = createRootStore(document.createElement('div'));
  let floating: UseFloatingReturn | undefined;

  render(() => (
    <BaseUITest
      rootContext={store}
      onRender={(value) => {
        floating = value;
      }}
    />
  ));
  await settle();

  expect(floating!.context.open()).toBe(true);

  store.set('open', false);
  expect(store.state.open).toBe(false);
  await settle();

  expect(floating!.context.open()).toBe(false);
});
