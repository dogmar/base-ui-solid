import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Solid port note: `active` is exposed as an accessor.
 */
export interface DrawerProviderContext {
  setDrawerOpen: (drawer: object, open: boolean) => void;
  removeDrawer: (drawer: object) => void;
  active: Accessor<boolean>;
  visualStateStore: DrawerVisualStateStore;
}

export const DrawerProviderContext = createOptionalContext<DrawerProviderContext>();

export interface DrawerVisualState {
  swipeProgress: number;
  frontmostHeight: number;
}

export interface DrawerVisualStateStore {
  getSnapshot: () => DrawerVisualState;
  subscribe: (listener: () => void) => () => void;
  set: (state: Partial<DrawerVisualState>) => void;
}

export function useDrawerProviderContext() {
  return useOptionalContext(DrawerProviderContext);
}
