import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  DrawerProviderContext,
  type DrawerVisualState,
  type DrawerVisualStateStore,
} from './DrawerProviderContext';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

/**
 * Provides a shared context for coordinating global Drawer UI, such as indent/background effects based on whether any Drawer is open.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerProvider(props: DrawerProvider.Props): JSX.Element {
  const [openDrawers, setOpenDrawers] = createSignal(new Set<object>(), { ownedWrite: true });
  const visualStateStore = createVisualStateStore();

  const setDrawerOpen = (drawer: object, open: boolean) => {
    setOpenDrawers((prev) => {
      if (prev.has(drawer) === open) {
        return prev;
      }

      const next = new Set(prev);
      if (open) {
        next.add(drawer);
      } else {
        next.delete(drawer);
      }
      return next;
    });
  };

  const removeDrawer = (drawer: object) => {
    setDrawerOpen(drawer, false);
  };

  const active = () => openDrawers().size > 0;

  const contextValue: DrawerProviderContext = {
    setDrawerOpen,
    removeDrawer,
    active,
    visualStateStore,
  };

  return (
    <DrawerProviderContext value={contextValue}>
      <IsolateChildren>{props.children}</IsolateChildren>
    </DrawerProviderContext>
  );
}

export interface DrawerProviderState {}

export interface DrawerProviderProps {
  children?: JSX.Element;
}

export namespace DrawerProvider {
  export type State = DrawerProviderState;
  export type Props = DrawerProviderProps;
}

type VisualStateListener = () => void;

function createVisualStateStore(): DrawerVisualStateStore {
  let state: DrawerVisualState = {
    swipeProgress: 0,
    frontmostHeight: 0,
  };
  const listeners = new Set<VisualStateListener>();

  return {
    getSnapshot: () => state,
    set(nextState) {
      let nextSwipeProgress = state.swipeProgress;
      if (nextState.swipeProgress !== undefined) {
        nextSwipeProgress = Number.isFinite(nextState.swipeProgress) ? nextState.swipeProgress : 0;
      }

      let nextFrontmostHeight = state.frontmostHeight;
      if (nextState.frontmostHeight !== undefined) {
        nextFrontmostHeight = Number.isFinite(nextState.frontmostHeight)
          ? nextState.frontmostHeight
          : 0;
      }

      if (
        nextSwipeProgress === state.swipeProgress &&
        nextFrontmostHeight === state.frontmostHeight
      ) {
        return;
      }

      state = {
        swipeProgress: nextSwipeProgress,
        frontmostHeight: nextFrontmostHeight,
      };

      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
