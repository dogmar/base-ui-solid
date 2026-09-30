import { vi, it, describe, expect } from 'vitest';
import { createMemo, createSignal, flush, onCleanup, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';

import { mergeProps } from '../../merge-props';
import { FloatingNode, FloatingTree, useFloatingNodeId } from '../components/FloatingTree';
import {
  getGridNavigatedIndex,
  isIndexOutOfListBounds,
  type DisabledIndices,
} from '../utils/composite';
import { useFloating } from './useFloating';
import { useListNavigation, type UseListNavigationProps } from './useListNavigation';

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    flush();
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
  flush();
}

/**
 * Local stand-in for the React `hooks/gridNavigation.ts` module, which is not
 * ported yet. Mirrors its implementation on top of the ported composite utils.
 */
function gridNavigation(
  event: KeyboardEvent,
  prevIndex: number,
  listRef: { current: Array<HTMLElement | null> },
  orientation: 'horizontal' | 'vertical' | 'both',
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols = 2,
): number | undefined {
  const nextIndex = getGridNavigatedIndex(listRef.current, {
    event,
    orientation,
    loopFocus,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    // An out-of-range previous index falls back to the first enabled item.
    prevIndex: prevIndex > maxIndex ? minIndex : prevIndex,
    stopEvent: true,
  });

  return isIndexOutOfListBounds(listRef.current, nextIndex) ? undefined : nextIndex;
}

function App(
  props: Omit<Partial<UseListNavigationProps>, 'listRef'> & {
    disableFirstItem?: boolean;
    hideFirstItem?: boolean;
    firstItemStyle?: JSX.CSSProperties;
  },
) {
  const [open, setOpen] = createSignal(false, { ownedWrite: true });
  const listRef = { current: [] as Array<HTMLElement | null> };
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null, { ownedWrite: true });
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });
  const nav = useListNavigation(context, {
    listRef,
    get activeIndex() {
      return activeIndex();
    },
    onNavigate(index) {
      setActiveIndex(index);
      props.onNavigate?.(index, undefined);
    },
    get selectedIndex() {
      return props.selectedIndex;
    },
    get loopFocus() {
      return props.loopFocus;
    },
    get allowEscape() {
      return props.allowEscape;
    },
    get virtual() {
      return props.virtual;
    },
    get orientation() {
      return props.orientation;
    },
    get rtl() {
      return props.rtl;
    },
    get focusItemOnOpen() {
      return props.focusItemOnOpen;
    },
    get focusItemOnHover() {
      return props.focusItemOnHover;
    },
    get openOnArrowKeyDown() {
      return props.openOnArrowKeyDown;
    },
    get disabledIndices() {
      return props.disabledIndices;
    },
  });

  function isItemDisabled(index: number) {
    return Boolean(
      (props.disableFirstItem && index === 0) ||
      (typeof props.disabledIndices === 'function'
        ? props.disabledIndices(index)
        : props.disabledIndices?.includes(index)),
    );
  }

  function Menu() {
    onCleanup(() => {
      refs.setFloating(null);
      listRef.current = [];
    });
    return (
      // The real floating elements have `tabindex="-1"`; jsdom needs it for
      // `.focus()` on the container to take effect.
      <div role="menu" tabindex={-1} ref={refs.setFloating} {...(nav.floating ?? {})}>
        <ul>
          <For each={['one', 'two', 'three']}>
            {(string, index) => (
              <li
                data-testid={`item-${index()}`}
                aria-selected={activeIndex() === index() ? 'true' : 'false'}
                style={
                  index() === 0
                    ? props.hideFirstItem
                      ? { display: 'none' }
                      : props.firstItemStyle
                    : undefined
                }
                tabindex={-1}
                aria-disabled={isItemDisabled(index()) ? 'true' : undefined}
                ref={(node: HTMLElement) => {
                  listRef.current[index()] = node;
                }}
                {...(nav.item ?? {})}
              >
                {string}
              </li>
            )}
          </For>
        </ul>
      </div>
    );
  }

  return (
    <>
      <button
        ref={refs.setReference}
        {...mergeProps({ onClick: () => setOpen((value) => !value) }, nav.reference ?? {})}
      />
      <Show when={open()}>
        <Menu />
      </Show>
    </>
  );
}

function VirtualizedGridRows(props: {
  totalItems?: number;
  initialActiveIndex?: number;
  loopFocus?: boolean;
  disabledIndices?: UseListNavigationProps['disabledIndices'];
  hiddenIndices?: number[];
}) {
  const COLUMNS = 5;
  const VISIBLE_ROWS = 3;
  const totalItems = props.totalItems ?? 100;

  const [open, setOpen] = createSignal(true, { ownedWrite: true });
  const [activeIndex, setActiveIndex] = createSignal<number | null>(props.initialActiveIndex ?? 0, {
    ownedWrite: true,
  });
  const listRef = { current: [] as Array<HTMLElement | null> };
  listRef.current.length = totalItems;

  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });

  const nav = useListNavigation(context, {
    listRef,
    get activeIndex() {
      return activeIndex();
    },
    onNavigate: (index) => setActiveIndex(index),
    virtual: true,
    get loopFocus() {
      return props.loopFocus ?? true;
    },
    orientation: 'horizontal',
    get disabledIndices() {
      return props.disabledIndices;
    },
    grid: gridNavigation,
  });

  return (
    <>
      <input
        data-testid="virtual-grid-reference"
        ref={refs.setReference}
        {...(nav.reference ?? {})}
      />
      <Show when={open()}>
        <div
          role="grid"
          data-testid="virtual-grid-floating"
          ref={refs.setFloating}
          {...(nav.floating ?? {})}
        >
          <For each={Array.from({ length: VISIBLE_ROWS }, (_row, rowIndex) => rowIndex)}>
            {(rowIndex) => (
              <div role="row">
                <For each={Array.from({ length: COLUMNS }, (_column, columnIndex) => columnIndex)}>
                  {(columnIndex) => {
                    const itemIndex = rowIndex * COLUMNS + columnIndex;
                    if (itemIndex >= totalItems) {
                      return null;
                    }

                    return (
                      <button
                        type="button"
                        role="gridcell"
                        style={
                          props.hiddenIndices?.includes(itemIndex) ? { display: 'none' } : undefined
                        }
                        data-active={activeIndex() === itemIndex ? '' : undefined}
                        ref={(node: HTMLElement) => {
                          listRef.current[itemIndex] = node;
                        }}
                        {...(nav.item ?? {})}
                      >
                        {itemIndex}
                      </button>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
      <span data-testid="virtual-grid-active-index" data-active-index={activeIndex() ?? ''} />
    </>
  );
}

describe('useListNavigation', () => {
  it('does not add role-dependent aria-orientation', async () => {
    render(() => <App orientation="horizontal" />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    expect(screen.getByRole('menu')).not.toHaveAttribute('aria-orientation');
  });

  it('opens on ArrowDown and focuses first item', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('opens on ArrowUp and focuses last item', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('navigates down on ArrowDown', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    // Reached the end of the list.
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('navigates up on ArrowUp', async () => {
    render(() => <App />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // Reached the end of the list.
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('skips disabled item on initial navigation', async () => {
    render(() => <App disableFirstItem loopFocus disabledIndices={[]} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('skips items hidden with CSS in navigation', async () => {
    render(() => <App hideFirstItem loopFocus disabledIndices={[]} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('skips visibility:hidden items in navigation', async () => {
    render(() => <App firstItemStyle={{ visibility: 'hidden' }} loopFocus disabledIndices={[]} />);

    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('resets indexRef to -1 upon close', async () => {
    const data = ['a', 'ab', 'abc', 'abcd'];

    function Autocomplete() {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const [inputValue, setInputValue] = createSignal('', { ownedWrite: true });
      const [activeIndex, setActiveIndex] = createSignal<number | null>(null, {
        ownedWrite: true,
      });

      const listRef = { current: [] as Array<HTMLElement | null> };

      const { context, refs } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: setOpen,
      });

      const nav = useListNavigation(context, {
        listRef,
        get activeIndex() {
          return activeIndex();
        },
        onNavigate: (index) => setActiveIndex(index),
        virtual: true,
        loopFocus: true,
      });

      function onInput(event: InputEvent) {
        const value = (event.currentTarget as HTMLInputElement).value;
        setInputValue(value);

        if (value) {
          setActiveIndex(null);
          setOpen(true);
        } else {
          setOpen(false);
        }
      }

      const items = createMemo(() =>
        data.filter((item) => item.toLowerCase().startsWith(inputValue().toLowerCase())),
      );

      function FloatingList() {
        onCleanup(() => {
          refs.setFloating(null);
          listRef.current = [];
        });
        return (
          <div data-testid="floating" ref={refs.setFloating} {...(nav.floating ?? {})}>
            <ul>
              <For each={items()}>
                {(item, index) => (
                  <li
                    ref={(node: HTMLElement) => {
                      listRef.current[index()] = node;
                    }}
                    {...(nav.item ?? {})}
                  >
                    {item}
                  </li>
                )}
              </For>
            </ul>
          </div>
        );
      }

      return (
        <>
          <input
            data-testid="reference"
            ref={refs.setReference}
            value={inputValue()}
            placeholder="Enter fruit"
            aria-autocomplete="list"
            {...mergeProps(
              {
                onInput,
                onKeyDown(event: KeyboardEvent) {
                  // Stand-in for `useDismiss` (not ported yet).
                  if (event.key === 'Escape') {
                    setOpen(false);
                  }
                },
              },
              nav.reference ?? {},
            )}
          />
          <Show when={open()}>
            <FloatingList />
          </Show>
          <div data-testid="active-index">{activeIndex()}</div>
        </>
      );
    }

    render(() => <Autocomplete />);

    screen.getByTestId('reference').focus();
    await userEvent.keyboard('a');
    await settle();

    expect(screen.getByTestId('floating')).toBeInTheDocument();
    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await settle();

    expect(screen.getByTestId('active-index').textContent).toBe('2');

    await userEvent.keyboard('{Escape}');
    await settle();

    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('a');
    await settle();

    expect(screen.getByTestId('floating')).toBeInTheDocument();
    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{ArrowDown}');
    await settle();

    expect(screen.getByTestId('active-index').textContent).toBe('0');
  });

  describe('prop: loopFocus', () => {
    it('ArrowDown looping', async () => {
      render(() => <App loopFocus />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list and loops.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });

    it('ArrowUp looping', async () => {
      render(() => <App loopFocus />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list and loops.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });
  });

  describe('prop: orientation', () => {
    it('navigates down on ArrowRight', async () => {
      render(() => <App orientation="horizontal" />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });

    it('navigates up on ArrowLeft', async () => {
      render(() => <App orientation="horizontal" />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowLeft' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });
  });

  describe('prop: rtl', () => {
    it('navigates down on ArrowLeft', async () => {
      render(() => <App rtl orientation="horizontal" />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowLeft' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });

    it('navigates up on ArrowRight', async () => {
      render(() => <App rtl orientation="horizontal" />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list.
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });
  });

  describe('prop: focusItemOnOpen', () => {
    it('focuses the first item on click when true', async () => {
      render(() => <App focusItemOnOpen />);
      fireEvent.click(screen.getByRole('button'));
      await settle();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });

    it('does not focus the first item on click when false', async () => {
      render(() => <App focusItemOnOpen={false} />);
      fireEvent.click(screen.getByRole('button'));
      await settle();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).not.toHaveFocus();
      });
    });
  });

  describe('prop: selectedIndex', () => {
    it('scrolls the selected item into view on open', async ({ onTestFinished }) => {
      const requestAnimationFrame = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation(() => 0);
      const scrollIntoView = vi.fn();
      const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      onTestFinished(() => {
        requestAnimationFrame.mockRestore();
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      });

      render(() => <App selectedIndex={0} />);
      fireEvent.click(screen.getByRole('button'));
      await settle();
      expect(requestAnimationFrame).toHaveBeenCalled();
      // Run the timer
      requestAnimationFrame.mock.calls.forEach((call) => call[0](0));
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('allowEscape + virtual', () => {
    it('when true', async () => {
      render(() => <App allowEscape virtual loopFocus />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      await settle();
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('false');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('false');
    });

    it('when false', async () => {
      render(() => <App allowEscape={false} virtual loopFocus />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true');
    });

    it('true - onNavigate is called with `null` when escaped', async () => {
      const spy = vi.fn();
      render(() => <App allowEscape virtual loopFocus onNavigate={spy} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      await settle();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.some((args) => args[0] === null)).toBe(true);
    });
  });

  describe('prop: openOnArrowKeyDown', () => {
    it('opens on ArrowDown when true', async () => {
      render(() => <App openOnArrowKeyDown />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens on ArrowUp when true', async () => {
      render(() => <App openOnArrowKeyDown />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      await settle();
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('does not open on ArrowDown when false', async () => {
      render(() => <App openOnArrowKeyDown={false} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('does not open on ArrowUp when false', async () => {
      render(() => <App openOnArrowKeyDown={false} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      await settle();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('prop: disabledIndices', () => {
    it('indices are skipped in focus order', async () => {
      render(() => <App disabledIndices={[0]} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await settle();
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
    });
  });

  describe('prop: focusItemOnHover', () => {
    it('true - focuses item on hover and syncs the active index', async () => {
      const spy = vi.fn();
      render(() => <App onNavigate={spy} />);
      fireEvent.click(screen.getByRole('button'));
      await settle();
      fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
      fireEvent.pointerLeave(screen.getByTestId('item-1'), { pointerType: 'mouse' });
      await settle();
      expect(screen.getByRole('menu')).toHaveFocus();
      expect(spy.mock.calls.some((args) => args[0] === 1)).toBe(true);
    });

    it('true - syncs an item on hover when activeIndex is null but selectedIndex matches', async () => {
      const spy = vi.fn();
      render(() => (
        <App focusItemOnOpen={false} selectedIndex={1} onNavigate={(index) => spy(index)} />
      ));

      fireEvent.click(screen.getByRole('button'));
      await settle();
      fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('false - does not focus item on hover and does not sync the active index', async () => {
      const spy = vi.fn();
      render(() => <App onNavigate={spy} focusItemOnOpen={false} focusItemOnHover={false} />);
      fireEvent.click(screen.getByRole('button'));
      await settle();
      fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
      await settle();
      expect(screen.getByTestId('item-1')).not.toHaveFocus();
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it('clears the active item when the pointer leaves a clipped container while still within the item bounds', async () => {
      const spy = vi.fn();
      render(() => <App onNavigate={spy} />);

      fireEvent.click(screen.getByRole('button'));
      await settle();

      const menu = screen.getByRole('menu');
      const item = screen.getByTestId('item-1');

      menu.style.overflow = 'auto';
      menu.style.maxHeight = '40px';

      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        right: 100,
        bottom: 40,
        left: 0,
        width: 100,
        height: 40,
        toJSON() {
          return {};
        },
      } as DOMRect);

      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        right: 100,
        bottom: 80,
        left: 0,
        width: 100,
        height: 80,
        toJSON() {
          return {};
        },
      } as DOMRect);

      fireEvent.mouseMove(item, { movementX: 10, movementY: 10 });

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      fireEvent.pointerLeave(item, {
        clientX: 50,
        clientY: 60,
        pointerType: 'mouse',
      });
      await settle();

      await waitFor(() => {
        expect(item).toHaveAttribute('aria-selected', 'false');
      });
      expect(spy.mock.calls.at(-1)?.[0]).toBe(null);
    });
  });

  describe('grid navigation (virtualized rows)', () => {
    it('wraps ArrowUp to the last row in the full list for virtualized rows', async () => {
      render(() => <VirtualizedGridRows />);

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '95',
        );
      });
    });

    it('clamps ArrowUp to the last item in a partial last row for virtualized rows', async () => {
      render(() => <VirtualizedGridRows totalItems={98} initialActiveIndex={4} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('clamps ArrowDown into a partial last row for virtualized rows', async () => {
      render(() => <VirtualizedGridRows totalItems={98} initialActiveIndex={93} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('does not wrap ArrowUp when loopFocus is false for virtualized rows', async () => {
      render(() => (
        <VirtualizedGridRows totalItems={98} initialActiveIndex={4} loopFocus={false} />
      ));

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '4',
        );
      });
    });

    it('still clamps ArrowDown into a partial last row when loopFocus is false', async () => {
      render(() => (
        <VirtualizedGridRows totalItems={98} initialActiveIndex={93} loopFocus={false} />
      ));

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('falls back left in a partial last row when the preferred candidate is disabled', async () => {
      render(() => (
        <VirtualizedGridRows totalItems={98} initialActiveIndex={93} disabledIndices={[97]} />
      ));

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '96',
        );
      });
    });

    it('falls back left when the preferred candidate is hidden', async () => {
      render(() => <VirtualizedGridRows initialActiveIndex={9} hiddenIndices={[14]} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await settle();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '13',
        );
      });
    });
  });

  describe('nested lists', () => {
    function ParentMenu() {
      const nodeId = useFloatingNodeId();
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const [activeIndex, setActiveIndex] = createSignal<null | number>(null, {
        ownedWrite: true,
      });
      const listRef = { current: [] as Array<HTMLElement | null> };
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: setOpen,
        nodeId,
      });
      const nav = useListNavigation(context, {
        listRef,
        get activeIndex() {
          return activeIndex();
        },
        onNavigate: (index) => setActiveIndex(index),
      });

      function SubmenuItem(itemProps: { index: number }) {
        const subNodeId = useFloatingNodeId();
        const [subOpen, setSubOpen] = createSignal(false, { ownedWrite: true });
        const [subActiveIndex, setSubActiveIndex] = createSignal<null | number>(null, {
          ownedWrite: true,
        });
        const subListRef = { current: [] as Array<HTMLElement | null> };
        const { refs: subRefs, context: subContext } = useFloating({
          get open() {
            return subOpen();
          },
          onOpenChange: setSubOpen,
          nodeId: subNodeId,
        });
        const subNav = useListNavigation(subContext, {
          listRef: subListRef,
          get activeIndex() {
            return subActiveIndex();
          },
          onNavigate: (index) => setSubActiveIndex(index),
          nested: true,
        });

        function SubMenuList() {
          onCleanup(() => {
            subRefs.setFloating(null);
            subListRef.current = [];
          });
          return (
            <div role="menu" tabindex={-1} ref={subRefs.setFloating} {...(subNav.floating ?? {})}>
              <For each={['Text', 'Video', 'Image']}>
                {(label, index) => (
                  <button
                    tabindex={-1}
                    ref={(node: HTMLElement) => {
                      subListRef.current[index()] = node;
                    }}
                    {...(subNav.item ?? {})}
                  >
                    {label}
                  </button>
                )}
              </For>
            </div>
          );
        }

        return (
          <FloatingNode id={subNodeId}>
            <button
              tabindex={-1}
              ref={(node: HTMLElement) => {
                listRef.current[itemProps.index] = node;
                subRefs.setReference(node);
              }}
              {...mergeProps(nav.item ?? {}, subNav.reference ?? {})}
            >
              Copy as
            </button>
            <Show when={subOpen()}>
              <SubMenuList />
            </Show>
          </FloatingNode>
        );
      }

      function MenuList() {
        onCleanup(() => {
          refs.setFloating(null);
          listRef.current = [];
        });
        return (
          <div
            role="menu"
            data-testid="parent-menu"
            tabindex={-1}
            ref={refs.setFloating}
            {...(nav.floating ?? {})}
          >
            <For each={['Undo', 'Redo']}>
              {(label, index) => (
                <button
                  tabindex={-1}
                  ref={(node: HTMLElement) => {
                    listRef.current[index()] = node;
                  }}
                  {...(nav.item ?? {})}
                >
                  {label}
                </button>
              )}
            </For>
            <SubmenuItem index={2} />
          </div>
        );
      }

      return (
        <FloatingNode id={nodeId}>
          <button
            ref={refs.setReference}
            {...mergeProps({ onClick: () => setOpen((value) => !value) }, nav.reference ?? {})}
          >
            Edit
          </button>
          <Show when={open()}>
            <MenuList />
          </Show>
        </FloatingNode>
      );
    }

    function NestedMenuFixture() {
      return (
        <FloatingTree>
          <ParentMenu />
        </FloatingTree>
      );
    }

    it('opens a submenu with the cross-orientation open key and focuses its first item', async () => {
      render(() => <NestedMenuFixture />);

      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await settle();

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByText('Undo')).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByText('Copy as')).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowRight}');
      await settle();

      await waitFor(() => {
        expect(screen.getByText('Text')).toHaveFocus();
      });
    });

    it('closes a submenu with the cross-orientation close key and refocuses its trigger item', async () => {
      render(() => <NestedMenuFixture />);

      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await settle();

      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{ArrowRight}');
      await settle();

      await waitFor(() => {
        expect(screen.getByText('Text')).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByText('Video')).toHaveFocus();
      });

      await userEvent.keyboard('{ArrowLeft}');
      await settle();

      expect(screen.queryByText('Text')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Copy as')).toHaveFocus();
      });
    });
  });

  it('Home or End key press is ignored for typeable combobox reference', async () => {
    function ComboboxApp() {
      const [open, setOpen] = createSignal(false, { ownedWrite: true });
      const listRef = { current: [] as Array<HTMLElement | null> };
      const [activeIndex, setActiveIndex] = createSignal<null | number>(null, {
        ownedWrite: true,
      });
      const { refs, context } = useFloating({
        get open() {
          return open();
        },
        onOpenChange: setOpen,
      });
      const nav = useListNavigation(context, {
        listRef,
        get activeIndex() {
          return activeIndex();
        },
        onNavigate: (index) => setActiveIndex(index),
      });

      function Menu() {
        onCleanup(() => {
          refs.setFloating(null);
          listRef.current = [];
        });
        return (
          <div role="menu" tabindex={-1} ref={refs.setFloating} {...(nav.floating ?? {})}>
            <ul>
              <For each={['one', 'two', 'three']}>
                {(string, index) => (
                  <li
                    data-testid={`item-${index()}`}
                    aria-selected={activeIndex() === index() ? 'true' : 'false'}
                    tabindex={-1}
                    ref={(node: HTMLElement) => {
                      listRef.current[index()] = node;
                    }}
                    {...(nav.item ?? {})}
                  >
                    {string}
                  </li>
                )}
              </For>
            </ul>
          </div>
        );
      }

      return (
        <>
          <input role="combobox" ref={refs.setReference} {...(nav.reference ?? {})} />
          <Show when={open()}>
            <Menu />
          </Show>
        </>
      );
    }

    render(() => <ComboboxApp />);

    screen.getByRole('combobox').focus();
    await settle();

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    await userEvent.keyboard('{End}');
    await settle();

    expect(screen.getByTestId('item-0')).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Home}');

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
  });
});
