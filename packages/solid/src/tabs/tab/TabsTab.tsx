import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { useCompositeItem } from '../../internals/composite/item/useCompositeItem';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import type { TabsRoot } from '../root/TabsRoot';
import { useTabsRootContext } from '../root/TabsRootContext';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsListContext } from '../list/TabsListContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { activeElement, contains } from '../../floating-ui-react/utils';

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsTab(componentProps: TabsTab.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'disabled',
    'render',
    'value',
    'id',
    'nativeButton',
    'style',
    'ref',
  );

  const rootContext = useTabsRootContext();
  const listContext = useTabsListContext();
  const compositeRootContext = useCompositeRootContext();

  const disabled = () => componentProps.disabled ?? false;
  const nativeButton = () => componentProps.nativeButton ?? true;

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  const {
    compositeProps,
    compositeRef,
    index,
    // hook is used instead of the CompositeItem component
    // because the index is needed for Tab internals
  } = useCompositeItem<TabsTab.Metadata>({
    get metadata() {
      return { disabled: disabled(), id: id(), value: componentProps.value };
    },
  });

  const active = () => componentProps.value === rootContext.value();

  let isNavigating = false;
  let unobserveTabElement: (() => void) | null = null;

  // Registered from the ref callback rather than an effect so the observer
  // follows the rendered element when the `render` prop swaps the host element.
  const observeTabElement = (element: HTMLElement | null) => {
    unobserveTabElement?.();
    unobserveTabElement = element
      ? listContext.registerTabResizeObserverElement(element)
      : null;
  };

  // Mirrors the React `onKeyDownCapture` handler: a native capture listener so
  // user handlers (or `preventBaseUIHandler`) can't suppress the flag.
  function markNavigating() {
    isNavigating = true;
  }
  const navigationTrackerRef = (element: HTMLElement | null) => {
    element?.addEventListener('keydown', markNavigating, true);
  };

  // Keep the highlighted item in sync with the currently active tab
  // when the value prop changes externally (controlled mode)
  createEffect(
    () => ({
      active: active(),
      index: index(),
      highlightedIndex: compositeRootContext.highlightedIndex(),
      disabled: disabled(),
      tabsListElement: listContext.tabsListElement(),
    }),
    (current) => {
      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(current.active && current.index > -1 && current.highlightedIndex !== current.index)) {
        return;
      }

      // If focus is currently within the tabs list, don't override the roving
      // focus highlight. This keeps keyboard navigation relative to the focused
      // item after an external/asynchronous selection change.
      const listElement = current.tabsListElement;
      if (listElement != null) {
        const activeEl = activeElement(ownerDocument(listElement));
        if (activeEl && contains(listElement, activeEl)) {
          return;
        }
      }

      // Don't highlight disabled tabs to prevent them from interfering with keyboard navigation.
      // Keyboard focus (tabIndex) should remain on an enabled tab even when a disabled tab is selected.
      if (!current.disabled) {
        compositeRootContext.onHighlightedIndexChange(current.index);
      }
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
    focusableWhenDisabled: true,
  });

  const tabPanelId = () => rootContext.getTabPanelIdByValue(componentProps.value);

  let isPressing = false;
  let isMainButton = false;

  // Both callers guard on `!active`, so the current value is never re-committed.
  function activate(event: Event) {
    rootContext.onValueChange(
      componentProps.value,
      createChangeEventDetails(REASONS.none, event, undefined, {
        activationDirection: 'none',
      }),
    );
  }

  function onClick(event: MouseEvent) {
    if (active() || disabled()) {
      return;
    }

    activate(event);
  }

  function onFocus(event: FocusEvent) {
    if (active() || disabled()) {
      return;
    }

    if (
      listContext.activateOnFocus() &&
      (!isPressing || // keyboard or touch focus
        isMainButton) // main mouse button focus
    ) {
      activate(event);
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (active() || disabled()) {
      return;
    }

    isPressing = true;
    // Secondary presses (context menu, middle click) may focus the tab, but
    // must not activate it with `activateOnFocus`.
    isMainButton = event.button === 0;

    // Registered for every button so a secondary press doesn't leave the tab
    // stuck in the pressing state, which would suppress later focus activation.
    const doc = ownerDocument(event.currentTarget as HTMLElement);

    function handlePointerEnd() {
      isPressing = false;
      isMainButton = false;
      doc.removeEventListener('pointerup', handlePointerEnd);
      doc.removeEventListener('pointercancel', handlePointerEnd);
    }

    doc.addEventListener('pointerup', handlePointerEnd);
    doc.addEventListener('pointercancel', handlePointerEnd);
  }

  const state: TabsTabState = {
    get disabled() {
      return disabled();
    },
    get active() {
      return active();
    },
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
  };

  return useRenderElement('button', componentProps, {
    state,
    ref: [buttonRef, compositeRef, observeTabElement, navigationTrackerRef],
    props: [
      compositeProps,
      {
        role: 'tab',
        get 'aria-controls'() {
          return tabPanelId();
        },
        get 'aria-selected'() {
          // Solid renders boolean attribute values as presence/absence; aria
          // attributes need explicit strings.
          return active() ? 'true' : 'false';
        },
        get id() {
          return id();
        },
        onClick,
        onFocus,
        onPointerDown,
        get [ACTIVE_COMPOSITE_ITEM as string]() {
          return active() ? '' : undefined;
        },
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping: tabsStateAttributesMapping,
  });
}

export type TabsTabValue = any | null;

export type TabsTabActivationDirection = 'left' | 'right' | 'up' | 'down' | 'none';

export interface TabsTabPosition {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TabsTabSize {
  width: number;
  height: number;
}

export interface TabsTabMetadata {
  disabled: boolean;
  id: string | undefined;
  value: TabsTab.Value | undefined;
}

export interface TabsTabState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component is active.
   */
  active: boolean;
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsTabProps
  extends NativeButtonProps, BaseUIComponentProps<'button', TabsTabState> {
  /**
   * The value of the Tab.
   */
  value: TabsTab.Value;
  /**
   * Whether the Tab is disabled.
   *
   * If a first Tab on a `<Tabs.List>` is disabled, it won't initially be selected.
   * Instead, the next enabled Tab will be selected.
   * However, it does not work like this during server-side rendering, as it is not known
   * during pre-rendering which Tabs are disabled.
   * To work around it, ensure that `defaultValue` or `value` on `<Tabs.Root>` is set to an enabled Tab's value.
   */
  disabled?: boolean | undefined;
}

export namespace TabsTab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}
