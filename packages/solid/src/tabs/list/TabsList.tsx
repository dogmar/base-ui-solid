import { createEffect, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import { applyRef } from '../../solid-utils/refs';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { TabsRootState } from '../root/TabsRoot';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import { TabsListContext } from './TabsListContext';
import type { TabsTab } from '../tab/TabsTab';

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsList(componentProps: TabsList.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'activateOnFocus',
    'className',
    'class',
    'loopFocus',
    'render',
    'style',
    'ref',
  );

  const rootContext = useTabsRootContext();

  const activateOnFocus = () => componentProps.activateOnFocus ?? false;
  const loopFocus = () => componentProps.loopFocus ?? true;

  const [highlightedTabIndex, setHighlightedTabIndex] = createSignal(0, { ownedWrite: true });
  const [tabsListElement, setTabsListElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });

  const indicatorUpdateListeners = new Set<() => void>();
  const tabResizeObserverElements = new Set<HTMLElement>();
  let resizeObserver: ResizeObserver | null = null;

  createEffect(
    () => tabsListElement(),
    (listElement) => {
      if (typeof ResizeObserver === 'undefined') {
        return undefined;
      }

      const observer = new ResizeObserver(() => {
        indicatorUpdateListeners.forEach((listener) => {
          listener();
        });
      });

      resizeObserver = observer;

      if (listElement) {
        observer.observe(listElement);
      }

      tabResizeObserverElements.forEach((element) => {
        observer.observe(element);
      });

      return () => {
        observer.disconnect();
        resizeObserver = null;
      };
    },
  );

  const registerIndicatorUpdateListener = (listener: () => void) => {
    indicatorUpdateListeners.add(listener);
    return () => {
      indicatorUpdateListeners.delete(listener);
    };
  };

  const registerTabResizeObserverElement = (element: HTMLElement) => {
    tabResizeObserverElements.add(element);
    resizeObserver?.observe(element);
    return () => {
      tabResizeObserverElements.delete(element);
      resizeObserver?.unobserve(element);
    };
  };

  const state: TabsListState = {
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return rootContext.orientation() === 'vertical' ? 'vertical' : undefined;
    },
    role: 'tablist',
  };

  const tabsListContextValue: TabsListContext = {
    activateOnFocus,
    registerIndicatorUpdateListener,
    registerTabResizeObserverElement,
    tabsListElement,
  };

  return (
    <TabsListContext value={tabsListContextValue}>
      <CompositeRoot<TabsTab.Metadata, TabsListState>
        render={componentProps.render}
        className={componentProps.className}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        refs={[(el: HTMLElement | null) => applyRef(componentProps.ref, el), setTabsListElement]}
        props={[defaultProps, elementProps]}
        stateAttributesMapping={tabsStateAttributesMapping}
        highlightedIndex={highlightedTabIndex()}
        enableHomeAndEndKeys
        loopFocus={loopFocus()}
        orientation={rootContext.orientation()}
        onHighlightedIndexChange={setHighlightedTabIndex}
        onMapChange={rootContext.setTabMap}
        disabledIndices={EMPTY_ARRAY as number[]}
      />
    </TabsListContext>
  );
}

export interface TabsListState extends TabsRootState {}

export interface TabsListProps extends BaseUIComponentProps<'div', TabsListState> {
  /**
   * Whether to automatically change the active tab on arrow key focus.
   * Otherwise, tabs will be activated using <kbd>Enter</kbd> or <kbd>Space</kbd> key press.
   * @default false
   */
  activateOnFocus?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace TabsList {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
