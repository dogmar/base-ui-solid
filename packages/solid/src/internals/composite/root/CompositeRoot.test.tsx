import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { DirectionProvider } from '../../../direction-provider';
import { CompositeItem } from '../item/CompositeItem';
import { useCompositeListItem } from '../list/useCompositeListItem';
import { CompositeRoot } from './CompositeRoot';
import { gridNavigation } from './gridNavigation';

const threeColsGrid = gridNavigation({ cols: 3 });

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('Composite', () => {
  const gridItems = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function IndexedItem(props: { index: number; active?: boolean; testId: string }) {
    const { ref } = useCompositeListItem({
      get index() {
        return props.index;
      },
    });
    return (
      <div
        ref={ref}
        data-testid={props.testId}
        data-composite-item-active={props.active ? '' : undefined}
      />
    );
  }

  function TestGridItems() {
    return (
      <>
        {gridItems.map((i) => (
          <CompositeItem data-testid={i}>{i}</CompositeItem>
        ))}
      </>
    );
  }

  describe('list', () => {
    it('does not add aria-orientation when orientation is set', async () => {
      const { container } = render(() => (
        <CompositeRoot orientation="horizontal">
          <CompositeItem>1</CompositeItem>
          <CompositeItem>2</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      expect(container.firstElementChild as HTMLElement).not.toHaveAttribute('aria-orientation');
    });

    it('controlled mode', async () => {
      const [highlightedIndex, setHighlightedIndex] = createSignal(0, { ownedWrite: true });

      render(() => (
        <CompositeRoot
          highlightedIndex={highlightedIndex()}
          onHighlightedIndexChange={setHighlightedIndex}
        >
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uncontrolled mode', async () => {
      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uses an active item explicit index as the initial highlighted index', async () => {
      const onHighlightedIndexChange = vi.fn();

      render(() => (
        <CompositeRoot highlightedIndex={0} onHighlightedIndexChange={onHighlightedIndexChange}>
          <IndexedItem testId="two" index={2} active />
          <IndexedItem testId="zero" index={0} />
          <IndexedItem testId="one" index={1} />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      expect(onHighlightedIndexChange).toHaveBeenCalledWith(2);
    });

    it.each([
      { orientation: 'horizontal' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'horizontal' as const, key: 'ArrowDown', prevented: false },
      { orientation: 'vertical' as const, key: 'ArrowDown', prevented: true },
      { orientation: 'vertical' as const, key: 'ArrowRight', prevented: false },
      { orientation: 'both' as const, key: 'ArrowRight', prevented: true },
      { orientation: 'both' as const, key: 'ArrowDown', prevented: true },
    ])(
      'sets default prevention to $prevented for $key with $orientation orientation',
      async ({ orientation, key, prevented }) => {
        render(() => (
          <CompositeRoot orientation={orientation}>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
          </CompositeRoot>
        ));
        await flushMicrotasks();

        const item1 = screen.getByTestId('1');
        item1.focus();
        await flushMicrotasks();

        const allowed = fireEvent.keyDown(item1, { key });
        await flushMicrotasks();

        expect(allowed).toBe(!prevented);
      },
    );

    describe('Home and End keys', () => {
      it('Home key moves focus to the first item', async () => {
        render(() => (
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        ));
        await flushMicrotasks();

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        item3.focus();
        await flushMicrotasks();

        fireEvent.keyDown(item3, { key: 'Home' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();
      });

      it('End key moves focus to the last item', async () => {
        render(() => (
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        ));
        await flushMicrotasks();

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'End' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });

    it('calls onLoop and uses its return value', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => 1,
      );

      render(() => (
        <CompositeRoot onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowDown');
      expect(prevIndex).toBe(8);
      expect(nextIndex).toBe(0);
      expect(elementsRef.current[8]).toBe(screen.getByTestId('9'));
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => nextIndex,
      );

      render(() => (
        <CompositeRoot loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    describe('rtl', () => {
      it('horizontal orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="horizontal">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));
        await flushMicrotasks();

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        // loop backward
        fireEvent.keyDown(item1, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });

      it('both horizontal and vertical orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="both">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));
        await flushMicrotasks();

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        item1.focus();
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });
  });

  describe('grid', () => {
    it('prevents default for grid navigation outside the configured orientation', async () => {
      render(() => (
        <CompositeRoot grid={threeColsGrid} orientation="horizontal">
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      item1.focus();
      await flushMicrotasks();

      const allowed = fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(allowed).toBe(false);
    });

    it('uniform 1x1 items', async () => {
      render(() => (
        <CompositeRoot grid={threeColsGrid} enableHomeAndEndKeys>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('1').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('7')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('6')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('6')).toHaveFocus();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
    });

    it('calls onLoop while navigating through grid cells', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => 4,
      );

      render(() => (
        <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('6').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('6'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowRight');
      expect(prevIndex).toBe(5);
      expect(nextIndex).toBe(3);
      expect(elementsRef.current[5]).toBe(screen.getByTestId('6'));
      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();
    });

    it('calls onLoop when looping vertically between rows', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => nextIndex,
      );

      render(() => (
        <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);

      const [downEvent, downPrevIndex, downNextIndex] = onLoop.mock.calls[0]!;
      expect(downEvent.key).toBe('ArrowDown');
      expect(downPrevIndex).toBe(8);
      expect(downNextIndex).toBe(2);
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);

      const [upEvent, upPrevIndex, upNextIndex] = onLoop.mock.calls[1]!;
      expect(upEvent.key).toBe('ArrowUp');
      expect(upPrevIndex).toBe(2);
      expect(upNextIndex).toBe(8);
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('stays on the current item when onLoop returns prevIndex', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          prevIndex: number,
          _nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => prevIndex,
      );

      render(() => (
        <CompositeRoot grid={threeColsGrid} orientation="horizontal" onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: { current: Array<HTMLElement | null> },
        ) => nextIndex,
      );

      render(() => (
        <CompositeRoot grid={threeColsGrid} loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('9').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('skips disabled indices', async () => {
      render(() => (
        <CompositeRoot grid={threeColsGrid} disabledIndices={[4]}>
          <TestGridItems />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      screen.getByTestId('2').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();
    });

    it('packs items into earlier gaps when dense', async () => {
      render(() => (
        <CompositeRoot
          grid={gridNavigation({
            cols: 2,
            dense: true,
            itemSizes: [
              { width: 1, height: 1 },
              { width: 2, height: 1 },
              { width: 1, height: 1 },
            ],
          })}
        >
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      // Item 2 is too wide for the first row, so dense packing backfills
      // item 3 into the gap next to item 1. Without `dense`, that cell stays
      // empty and item 3 is placed below item 2.
      screen.getByTestId('1').focus();
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    describe('rtl', () => {
      it('horizontal orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="horizontal" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));
        await flushMicrotasks();

        screen.getByTestId('1').focus();
        await flushMicrotasks();

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('2')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('3')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      });

      it('both horizontal and vertical orientation', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="both" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));
        await flushMicrotasks();

        screen.getByTestId('1').focus();
        await flushMicrotasks();

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('8')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('7')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      });

      it('uses the forward edge when navigating from a spanning item', async () => {
        render(() => (
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot
                grid={gridNavigation({
                  cols: 3,
                  itemSizes: [
                    { width: 1, height: 1 },
                    { width: 2, height: 1 },
                    { width: 1, height: 1 },
                  ],
                })}
                orientation="both"
              >
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>
        ));
        await flushMicrotasks();

        screen.getByTestId('2').focus();
        await flushMicrotasks();

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('1')).toHaveFocus();
      });
    });
  });

  describe('prop: disabledIndices', () => {
    it('moves the initial tab stop to the first enabled item when the default item is disabled', async () => {
      render(() => (
        <CompositeRoot disabledIndices={[0]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the initial tab stop when all items are disabled', async () => {
      render(() => (
        <CompositeRoot disabledIndices={[0, 1]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('disables navigating item when their index is included', async () => {
      const [highlightedIndex, setHighlightedIndex] = createSignal(0, { ownedWrite: true });

      render(() => (
        <CompositeRoot
          highlightedIndex={highlightedIndex()}
          onHighlightedIndexChange={setHighlightedIndex}
          disabledIndices={[1]}
        >
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('allows navigating items disabled in the DOM when their index is excluded', async () => {
      const [highlightedIndex, setHighlightedIndex] = createSignal(0, { ownedWrite: true });

      render(() => (
        <CompositeRoot
          highlightedIndex={highlightedIndex()}
          onHighlightedIndexChange={setHighlightedIndex}
          disabledIndices={[]}
        >
          <CompositeItem
            data-testid="1"
            data-disabled=""
            aria-disabled="true"
            render={(props) => <span {...props} />}
          />
          <CompositeItem
            data-testid="2"
            data-disabled=""
            aria-disabled="true"
            render={(props) => <span {...props} />}
          />
          <CompositeItem
            data-testid="3"
            data-disabled=""
            aria-disabled="true"
            render={(props) => <span {...props} />}
          />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();
    });
  });

  describe('item removal', () => {
    it('keeps the tab stop on the highlighted item when an earlier item is removed', async () => {
      const [showFirst, setShowFirst] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeRoot>
          <Show when={showFirst()}>
            <CompositeItem data-testid="1" />
          </Show>
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
          <CompositeItem data-testid="4" />
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      item1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      setShowFirst(false);
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '-1');

      // navigation continues from the item that holds the tab stop
      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveFocus();
    });

    it('moves the tab stop back into range when the highlighted item is removed', async () => {
      const [showLast, setShowLast] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <Show when={showLast()}>
            <CompositeItem data-testid="3" />
          </Show>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      item1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      setShowLast(false);
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('moves the tab stop to the active item when the highlighted item is removed', async () => {
      const [showLast, setShowLast] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" data-composite-item-active="" />
          <Show when={showLast()}>
            <CompositeItem data-testid="4" />
          </Show>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      item3.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      setShowLast(false);
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
    });

    it('skips items that cannot hold the tab stop', async () => {
      const [showLast, setShowLast] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" style={{ display: 'none' }} />
          <CompositeItem data-testid="2" aria-disabled="true" />
          <CompositeItem data-testid="3" />
          <Show when={showLast()}>
            <CompositeItem data-testid="4" />
          </Show>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item3 = screen.getByTestId('3');
      expect(item3).toHaveAttribute('tabindex', '0');

      item3.focus();
      await flushMicrotasks();

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');

      setShowLast(false);
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
    });

    it('keeps the tab stop in range when no item can hold it', async () => {
      const [showLast, setShowLast] = createSignal(true, { ownedWrite: true });

      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1" aria-disabled="true" />
          <CompositeItem data-testid="2" aria-disabled="true" />
          <Show when={showLast()}>
            <CompositeItem data-testid="3" />
          </Show>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');

      setShowLast(false);
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('prop: modifierKeys', () => {
    it('prevents arrow key navigation when any modifier key is pressed by default', async () => {
      render(() => (
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();
    });

    it('specifies allowed modifier keys that do not prevent arrow key navigation when pressed', async () => {
      render(() => (
        <CompositeRoot modifierKeys={['Alt', 'Meta']}>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>
      ));
      await flushMicrotasks();

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      item1.focus();
      await flushMicrotasks();

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item3).toHaveFocus();
    });
  });
});
