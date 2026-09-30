import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { createRef } from '../../../solid-utils/refs';
import { CompositeList } from './CompositeList';
import { useCompositeListItem } from './useCompositeListItem';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<CompositeList />', () => {
  describe('prop: elementsRef', () => {
    function Item(props: { label?: string; index?: number }) {
      const { ref, index } = useCompositeListItem({
        get index() {
          return props.index;
        },
        get label() {
          return props.label;
        },
      });
      return (
        <div ref={ref} data-testid={props.label} data-index={props.label ? index() : undefined}>
          {props.label}
        </div>
      );
    }

    it('cleans up refs on unmount', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };
      const { unmount } = render(() => (
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item label="a" />
          <Item label="b" />
          <Item label="c" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(elementsRef.current).toHaveLength(3);
      expect(labelsRef.current).toHaveLength(3);

      unmount();
      expect(elementsRef.current).toHaveLength(0);
      expect(labelsRef.current).toHaveLength(0);
    });

    it('only publishes maps that are aligned with the element registry', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const snapshots: Array<{
        elements: Array<HTMLElement | null>;
        mapElements: Element[];
      }> = [];

      const [items, setItems] = createSignal(['a', 'b', 'c'], { ownedWrite: true });

      render(() => (
        <CompositeList
          elementsRef={elementsRef}
          onMapChange={(map) => {
            snapshots.push({
              elements: [...elementsRef.current],
              mapElements: Array.from(map.keys()) as Element[],
            });
          }}
        >
          {items().map((item) => (
            <Item label={item} />
          ))}
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(snapshots).toHaveLength(1);

      setItems(['a', 'b', 'c', 'd']);
      await flushMicrotasks();

      snapshots.forEach((snapshot) => {
        expect(snapshot.elements).toEqual(snapshot.mapElements);
      });
      expect(snapshots.at(-1)!.mapElements).toHaveLength(4);
    });

    it('registers explicitly indexed items in their index-addressed slots', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const onMapChange = vi.fn();

      render(() => (
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <Item label="two" index={2} />
          <Item label="zero" index={0} />
          <Item label="one" index={1} />
        </CompositeList>
      ));
      await flushMicrotasks();

      const map = onMapChange.mock.lastCall?.[0] as Map<Element, { index: number }>;
      expect(Array.from(map.values(), (metadata) => metadata.index)).toEqual([0, 1, 2]);
      expect(elementsRef.current).toEqual([
        screen.getByTestId('zero'),
        screen.getByTestId('one'),
        screen.getByTestId('two'),
      ]);
    });

    it('reserves explicit slots when assigning automatic indexes', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <Item label="automatic one" />
          <Item label="explicit zero" index={0} />
          <Item label="automatic two" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(elementsRef.current).toEqual([
        screen.getByTestId('explicit zero'),
        screen.getByTestId('automatic one'),
        screen.getByTestId('automatic two'),
      ]);
      expect(screen.getByTestId('automatic one')).toHaveAttribute('data-index', '1');
      expect(screen.getByTestId('automatic two')).toHaveAttribute('data-index', '2');
    });

    it('does not consume an index guess for an explicitly indexed item', async () => {
      const baselineElementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      const initialIndexes: Record<string, number> = {};

      function GuessedItem(props: { label: string; index?: number }) {
        const { ref, index } = useCompositeListItem({
          guess: true,
          get index() {
            return props.index;
          },
        });
        initialIndexes[props.label] = index();
        return <div ref={ref} data-testid={props.label} />;
      }

      render(() => (
        <>
          <CompositeList elementsRef={baselineElementsRef}>
            <GuessedItem label="baseline automatic" />
          </CompositeList>
          <CompositeList elementsRef={elementsRef}>
            <GuessedItem label="explicit" index={1} />
            <GuessedItem label="automatic" />
          </CompositeList>
        </>
      ));
      await flushMicrotasks();

      expect(initialIndexes.automatic).toBe(initialIndexes['baseline automatic']);
      expect(elementsRef.current[0]).toBe(screen.getByTestId('automatic'));
      expect(elementsRef.current[1]).toBe(screen.getByTestId('explicit'));
    });

    it('does not register negative explicit indexes', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <Item label="item" index={-1} />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(elementsRef.current).toHaveLength(0);
      expect(Object.hasOwn(elementsRef.current, '-1')).toBe(false);
    });

    it('updates refs when an item mounts from a nested state update', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      const [showItem, setShowItem] = createSignal(false, { ownedWrite: true });

      function DeepSection() {
        return (
          <Show when={showItem()}>
            <Item label="nested" />
          </Show>
        );
      }

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <Item label="first" />
          <DeepSection />
          <Item label="last" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(elementsRef.current).toHaveLength(2);

      setShowItem(true);
      await flushMicrotasks();

      expect(elementsRef.current).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('nested'),
        screen.getByTestId('last'),
      ]);
    });

    it('updates refs when an item unmounts from a nested state update', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const onMapChange = vi.fn();

      const [showItem, setShowItem] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <Item label="first" />
          <Show when={showItem()}>
            <Item label="nested" />
          </Show>
          <Item label="last" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(elementsRef.current).toHaveLength(3);

      setShowItem(false);
      await flushMicrotasks();

      expect(elementsRef.current).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('last'),
      ]);
      const map = onMapChange.mock.lastCall?.[0] as Map<Element, unknown>;
      expect(Array.from(map.keys())).toEqual([
        screen.getByTestId('first'),
        screen.getByTestId('last'),
      ]);
      expect(screen.getByTestId('last')).toHaveAttribute('data-index', '1');
    });

    it('assigns correct guessed indexes during the first render', async () => {
      const renderCounts: Record<string, number> = { a: 0, b: 0, c: 0 };
      const initialIndexes: Record<string, number> = {};

      function GuessedItem(props: { label: string }) {
        const { ref, index } = useCompositeListItem({ guess: true });
        renderCounts[props.label] += 1;
        if (!(props.label in initialIndexes)) {
          initialIndexes[props.label] = index();
        }
        return <div ref={ref} data-testid={props.label} data-index={index()} />;
      }

      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <GuessedItem label="a" />
          <GuessedItem label="b" />
          <GuessedItem label="c" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(initialIndexes).toEqual({ a: 0, b: 1, c: 2 });
      expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });
      expect(elementsRef.current).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('b'),
        screen.getByTestId('c'),
      ]);
    });

    it('re-registers an item when its explicit index changes or is removed', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      const [explicitIndex, setExplicitIndex] = createSignal<number | undefined>(0, {
        ownedWrite: true,
      });

      function TrackedItem() {
        const { ref, index } = useCompositeListItem({
          guess: true,
          get index() {
            return explicitIndex();
          },
        });
        return <div ref={ref} data-testid="tracked" data-index={index()} />;
      }

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <TrackedItem />
        </CompositeList>
      ));
      await flushMicrotasks();

      const tracked = screen.getByTestId('tracked');
      expect(tracked).toHaveAttribute('data-index', '0');
      expect(elementsRef.current[0]).toBe(tracked);

      setExplicitIndex(2);
      await flushMicrotasks();

      expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '2');
      expect(Object.hasOwn(elementsRef.current, 0)).toBe(false);
      expect(elementsRef.current[2]).toBe(tracked);

      setExplicitIndex(undefined);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByTestId('tracked')).toHaveAttribute('data-index', '0');
      });
      expect(elementsRef.current).toEqual([tracked]);
    });

    it('excludes items detached outside the framework from the registry', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const onMapChange = vi.fn();

      const [extra, setExtra] = createSignal(false, { ownedWrite: true });

      render(() => (
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <div>
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
          <Show when={extra()}>
            <Item label="d" />
          </Show>
        </CompositeList>
      ));
      await flushMicrotasks();

      // Detaching a registered item outside the framework never fires its ref
      // callback, so it stays registered while disconnected.
      // `compareDocumentPosition` is meaningless for it, and leaving it in
      // would scramble the order of every other item.
      const detached = screen.getByTestId('b');
      detached.remove();

      setExtra(true);
      await flushMicrotasks();

      expect(elementsRef.current).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
      const map = onMapChange.mock.lastCall?.[0] as Map<Element, unknown>;
      expect(Array.from(map.keys())).toEqual([
        screen.getByTestId('a'),
        screen.getByTestId('c'),
        screen.getByTestId('d'),
      ]);
    });

    it('updates indexes when a leaf item moves outside the framework', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <div data-testid="container">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('a')).toHaveAttribute('data-index', '0');

      const container = screen.getByTestId('container');
      container.appendChild(screen.getByTestId('a'));

      await waitFor(() => {
        expect(screen.getByTestId('a')).toHaveAttribute('data-index', '2');
      });
      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '0');
      expect(screen.getByTestId('c')).toHaveAttribute('data-index', '1');
      expect(elementsRef.current).toEqual([
        screen.getByTestId('b'),
        screen.getByTestId('c'),
        screen.getByTestId('a'),
      ]);
    });

    it('observes each shared mutation root once', async () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef}>
          <div data-testid="list">
            <Item label="a" />
            <Item label="b" />
            <Item label="c" />
          </div>
        </CompositeList>
      ));
      await flushMicrotasks();

      const observedRoots = observe.mock.calls.map(([root]) => root);
      observe.mockRestore();
      expect(observedRoots).toEqual([screen.getByTestId('list')]);
    });

    it('ignores mutations for unrelated leaf nodes', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const onMapChange = vi.fn();

      render(() => (
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <div data-testid="list">
            <Item label="a" />
            <span data-testid="badge" />
            <Item label="b" />
          </div>
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('b')).toHaveAttribute('data-index', '1');
      onMapChange.mockClear();

      screen.getByTestId('badge').remove();
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByTestId('badge')).toBe(null);
      });
      expect(onMapChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: labelsRef', () => {
    function LabelledItem(props: {
      testId: string;
      label?: string | null;
      text?: string;
      useTextRef?: boolean;
    }) {
      const textRef = createRef<HTMLElement>();
      const { ref } = useCompositeListItem({
        get label() {
          return props.label;
        },
        textRef: props.useTextRef ? textRef : undefined,
      });
      return (
        <div ref={ref} data-testid={props.testId}>
          <span ref={(el) => (textRef.current = el)}>{props.text}</span>
          {props.useTextRef ? '-ignored' : ''}
        </div>
      );
    }

    it('resolves each label source', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };

      render(() => (
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <LabelledItem testId="explicit" label="explicit label" text="ignored" />
          {/* An explicit `null` means "no label", and must not fall back to the text. */}
          <LabelledItem testId="null-label" label={null} text="not a label" />
          <LabelledItem testId="text-ref" useTextRef text="from text ref" />
          <LabelledItem testId="element-text" text="from element" />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(labelsRef.current).toEqual(['explicit label', null, 'from text ref', 'from element']);
    });

    it('updates the label of a mounted item', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };

      const [label, setLabel] = createSignal('before', { ownedWrite: true });

      render(() => (
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <LabelledItem testId="item" label={label()} />
        </CompositeList>
      ));
      await flushMicrotasks();

      expect(labelsRef.current).toEqual(['before']);

      setLabel('after');
      await flushMicrotasks();

      expect(labelsRef.current).toEqual(['after']);
    });
  });

  describe('prop: onMapChange', () => {
    it('publishes item metadata alongside the index', async () => {
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const onMapChange = vi.fn();

      function MetadataItem(props: { testId: string; kind: string }) {
        const metadata = { kind: props.kind };
        const { ref } = useCompositeListItem({ metadata });
        return <div ref={ref} data-testid={props.testId} />;
      }

      render(() => (
        <CompositeList elementsRef={elementsRef} onMapChange={onMapChange}>
          <MetadataItem testId="first" kind="alpha" />
          <MetadataItem testId="second" kind="beta" />
        </CompositeList>
      ));
      await flushMicrotasks();

      const map = onMapChange.mock.lastCall?.[0] as Map<Element, { kind: string; index: number }>;
      expect(map.get(screen.getByTestId('first'))).toEqual({ kind: 'alpha', index: 0 });
      expect(map.get(screen.getByTestId('second'))).toEqual({ kind: 'beta', index: 1 });
    });
  });

  describe('without a parent list', () => {
    it('renders an item that is not wrapped in a list', async () => {
      function OrphanItem() {
        const { ref, index } = useCompositeListItem();
        return <div ref={ref} data-testid="orphan" data-index={index()} />;
      }

      const { unmount } = render(() => <OrphanItem />);
      await flushMicrotasks();

      // The default context no-ops keep a stray item inert rather than throwing.
      expect(screen.getByTestId('orphan')).toBeInTheDocument();
      expect(screen.getByTestId('orphan')).toHaveAttribute('data-index', '-1');
      expect(() => unmount()).not.toThrow();
    });
  });
});
