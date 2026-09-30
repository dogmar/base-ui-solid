import { expect, test, vi } from 'vitest';
import { createSignal, flush, onCleanup, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';

import { mergePropsN } from '../../merge-props';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStore';
import { useFloating } from '../index';
import { useClientPoint } from './useClientPoint';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

interface Coords {
  x: number;
  y: number;
}

function expectLocation({ x, y }: Coords) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(0);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(0);
}

function expectRect({ x, y, width, height }: DOMRectInit) {
  expect(Number(screen.getByTestId('x')?.textContent)).toBe(x);
  expect(Number(screen.getByTestId('y')?.textContent)).toBe(y);
  expect(Number(screen.getByTestId('width')?.textContent)).toBe(width);
  expect(Number(screen.getByTestId('height')?.textContent)).toBe(height);
}

function createRootStore(referenceElement: HTMLElement) {
  return new FloatingRootStore({
    open: false,
    transitionStatus: undefined,
    referenceElement,
    floatingElement: document.createElement('div'),
    triggerElements: new PopupTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: vi.fn(),
  });
}

function App(props: {
  enabled?: boolean;
  axis?: 'both' | 'x' | 'y';
  useTriggerProps?: boolean;
  openWithFocusEvent?: boolean;
}) {
  const [isOpen, setIsOpen] = createSignal(false, { ownedWrite: true });
  const floating = useFloating({
    get open() {
      return isOpen();
    },
    onOpenChange: (o) => setIsOpen(o),
  });
  const clientPoint = useClientPoint(floating.context, {
    get enabled() {
      return props.enabled ?? true;
    },
    get axis() {
      return props.axis;
    },
  });

  const rect = () => floating.elements.reference()?.getBoundingClientRect();

  function handleButtonClick() {
    if (!props.openWithFocusEvent) {
      setIsOpen((v) => !v);
      return;
    }

    floating.context.rootStore.setOpen(
      true,
      createChangeEventDetails(
        REASONS.triggerFocus,
        new FocusEvent('focus'),
        floating.refs.domReference.current as HTMLElement,
      ),
    );
  }

  return (
    <>
      <div
        data-testid="reference"
        ref={floating.refs.setReference}
        {...mergePropsN([props.useTriggerProps ? clientPoint.trigger : clientPoint.reference])}
        style={{ width: '0', height: '0', 'pointer-events': 'none' }}
      >
        Reference
      </div>
      <Show when={isOpen()}>
        {(_) => {
          onCleanup(() => floating.refs.setFloating(null));
          return (
            <div
              data-testid="floating"
              ref={floating.refs.setFloating}
              style={{ 'pointer-events': 'none' }}
            >
              Floating
            </div>
          );
        }}
      </Show>
      <button onClick={handleButtonClick} />
      <span data-testid="x">{rect()?.x}</span>
      <span data-testid="y">{rect()?.y}</span>
      <span data-testid="width">{rect()?.width}</span>
      <span data-testid="height">{rect()?.height}</span>
    </>
  );
}

test('updates position from trigger props', async () => {
  render(() => <App useTriggerProps />);
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 400,
      clientY: 200,
    }),
  );
  await settle();

  expectLocation({ x: 400, y: 200 });
});

test('uses trigger element when dom reference is missing', async () => {
  render(() => <App axis="x" />);
  await settle();

  const reference = screen.getByTestId('reference');
  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 50,
    width: 0,
    height: 0,
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    toJSON: () => {},
  });

  fireEvent.mouseMove(reference, {
    clientX: 200,
    clientY: 300,
  });
  await settle();

  expectLocation({ x: 200, y: 50 });
});

test('renders at mouse event coords', async () => {
  render(() => <App />);
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 1000,
      clientY: 1000,
    }),
  );
  await settle();

  expectLocation({ x: 1000, y: 1000 });

  // Window listener isn't registered unless the floating element is open.
  fireEvent(
    window,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );
  await settle();

  expectLocation({ x: 1000, y: 1000 });

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 700,
      clientY: 700,
    }),
  );
  await settle();

  expectLocation({ x: 700, y: 700 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await settle();

  expectLocation({ x: 0, y: 0 });
});

test('cleans up window listener when closing or disabling', async () => {
  const [enabled, setEnabled] = createSignal(true, { ownedWrite: true });

  render(() => <App enabled={enabled()} />);
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });

  setEnabled(false);
  await settle();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await settle();

  expectRect({ x: 0, y: 0, width: 0, height: 0 });
});

test('clears virtual references on unmount without retaining a stale DOM reference', async () => {
  const reference = document.createElement('button');
  const store = createRootStore(reference);
  const virtualReference = {
    getBoundingClientRect: () => reference.getBoundingClientRect(),
  };

  store.set('positionReference', virtualReference);

  const [enabled, setEnabled] = createSignal(true, { ownedWrite: true });

  function ClientPointStoreTest() {
    useClientPoint(store, {
      get enabled() {
        return enabled();
      },
    });
    return null;
  }

  const { unmount } = render(() => <ClientPointStoreTest />);
  await settle();

  setEnabled(false);
  await settle();

  expect(store.state.positionReference).toBe(reference);

  store.set('positionReference', virtualReference);
  unmount();
  flush();

  expect(store.state.positionReference).toBe(null);
});

test('axis x', async () => {
  render(() => <App axis="x" />);
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 0 });
});

test('axis y', async () => {
  render(() => <App axis="y" />);
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  expectLocation({ x: 0, y: 500 });
});

test('removes window listener when cursor lands on floating element', async () => {
  render(() => <App />);
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });
});

test('reattaches window listener after cursor returns from floating element to reference', async () => {
  render(() => <App />);
  await settle();

  fireEvent.click(screen.getByRole('button'));
  await settle();

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );

  fireEvent(
    screen.getByTestId('floating'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });

  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );
  await settle();

  // Reapply deterministic coordinates after the effect attaches the window listener.
  // A real browser cursor can emit an unrelated move while the effect is flushing.
  fireEvent(
    screen.getByTestId('reference'),
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 600,
      clientY: 700,
    }),
  );
  await settle();

  expectLocation({ x: 600, y: 700 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );
  await settle();

  expectLocation({ x: 100, y: 200 });
});

test('restores the DOM reference when opened by a non-mouse event', async () => {
  render(() => <App openWithFocusEvent />);
  await settle();

  const reference = screen.getByTestId('reference');

  reference.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    width: 30,
    height: 40,
    top: 20,
    right: 40,
    bottom: 60,
    left: 10,
    toJSON: () => {},
  });

  fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 500,
      clientY: 500,
    }),
  );
  await settle();

  expectLocation({ x: 500, y: 500 });

  fireEvent.click(screen.getByRole('button'));
  await settle();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });

  fireEvent(
    document.body,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 100,
      clientY: 200,
    }),
  );

  fireEvent(
    reference,
    new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 300,
      clientY: 400,
    }),
  );
  await settle();

  expectRect({ x: 10, y: 20, width: 30, height: 40 });
});
