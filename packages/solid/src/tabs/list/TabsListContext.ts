import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface TabsListContext {
  activateOnFocus: Accessor<boolean>;
  registerIndicatorUpdateListener: (listener: () => void) => () => void;
  registerTabResizeObserverElement: (element: HTMLElement) => () => void;
  tabsListElement: Accessor<HTMLElement | null>;
}

export const TabsListContext = createOptionalContext<TabsListContext>();

export function useTabsListContext() {
  const context = useOptionalContext(TabsListContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
    );
  }

  return context;
}
