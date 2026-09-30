import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  omit,
  untrack,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useControlled } from '../../solid-utils/useControlled';
import type { BaseUIComponentProps, Orientation as BaseOrientation } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { TabsRootContext } from './TabsRootContext';
import { tabsStateAttributesMapping } from './stateAttributesMapping';
import type { TabsTab } from '../tab/TabsTab';
import type { TabsPanel } from '../panel/TabsPanel';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsRoot(componentProps: TabsRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'defaultValue',
    'onValueChange',
    'orientation',
    'render',
    'value',
    'style',
    'ref',
  );

  const orientation = () => componentProps.orientation ?? 'horizontal';

  // Track whether the user explicitly provided a defined `defaultValue` prop.
  // Used to determine if we should honor a disabled tab selection.
  const hasExplicitDefaultValueProp = untrack(() => componentProps.defaultValue) !== undefined;
  const defaultValueProp = untrack(() =>
    componentProps.defaultValue === undefined ? 0 : componentProps.defaultValue,
  );

  const tabPanelRefs: { current: Array<HTMLElement | null> } = { current: [] };
  const [mountedTabPanels, setMountedTabPanels] = createSignal(
    new Map<TabsTab.Value, string>(),
    { ownedWrite: true },
  );

  const [value, setValue] = useControlled<TabsTab.Value>({
    controlled: () => componentProps.value,
    default: defaultValueProp,
    name: 'Tabs',
    state: 'value',
  });

  const isControlled = untrack(() => componentProps.value) !== undefined;

  const [tabMap, setTabMap] = createSignal(
    new Map<Node, CompositeMetadata<TabsTab.Metadata>>(),
    { ownedWrite: true },
  );
  let lastKnownTabElement: Node | undefined;

  // Used for activation direction detection via tab element positions.
  const getTabElementBySelectedValue = (selectedValue: TabsTab.Value): HTMLElement | null =>
    findTabElement(tabMap(), selectedValue);

  const [activationDirectionState, setActivationDirectionState] = createSignal(
    {
      previousValue: untrack(value),
      tabActivationDirection: 'none' as TabsTab.ActivationDirection,
    },
    { ownedWrite: true },
  );

  // Compute activation direction eagerly when the value changes so children see
  // the correct direction as soon as the selection updates. The previous value
  // snapshot is stored in state and synced by the render effect below.
  // https://github.com/mui/base-ui/issues/3873
  const activationDirectionInfo = createMemo(() => {
    const { previousValue, tabActivationDirection: committedTabActivationDirection } =
      activationDirectionState();
    const currentValue = value();

    let tabActivationDirection = committedTabActivationDirection;
    let directionComputationIncomplete = false;

    if (previousValue !== currentValue) {
      tabActivationDirection = computeActivationDirection(
        previousValue,
        currentValue,
        orientation(),
        tabMap(),
      );

      // When a new tab is added and selected in the same controlled update,
      // the tab element may not yet be registered in tabMap, so direction was
      // computed from a value-based fallback. Keep the previous value snapshot
      // stale so we re-compute from DOM positions once tabMap is up to date.
      directionComputationIncomplete =
        previousValue != null &&
        currentValue != null &&
        findTabElement(tabMap(), currentValue) == null;
    }

    const nextPreviousValue = directionComputationIncomplete ? previousValue : currentValue;

    return {
      tabActivationDirection,
      nextPreviousValue,
      shouldSyncActivationDirectionState:
        previousValue !== nextPreviousValue ||
        committedTabActivationDirection !== tabActivationDirection,
    };
  });

  const tabActivationDirection = () => activationDirectionInfo().tabActivationDirection;

  createRenderEffect(
    () => activationDirectionInfo(),
    (info) => {
      if (!info.shouldSyncActivationDirectionState) {
        return;
      }

      setActivationDirectionState({
        previousValue: info.nextPreviousValue,
        tabActivationDirection: info.tabActivationDirection,
      });
    },
  );

  const onValueChange = (
    newValue: TabsTab.Value,
    eventDetails: TabsRoot.ChangeEventDetails,
  ) => {
    const activationDirection = untrack(() =>
      computeActivationDirection(value(), newValue, orientation(), tabMap()),
    );

    eventDetails.activationDirection = activationDirection;

    componentProps.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    // Tab values may be functions; wrap so the setter never treats them as updaters.
    setValue(() => newValue);
  };

  const notifyAutomaticValueChange = (
    nextValue: TabsTab.Value,
    reason: TabsRoot.ChangeEventReason,
  ) => {
    componentProps.onValueChange?.(
      nextValue,
      createChangeEventDetails(reason, undefined, undefined, {
        activationDirection: 'none',
      }),
    );
  };

  const registerMountedTabPanel = (panelValue: TabsTab.Value, panelId: string) => {
    setMountedTabPanels((prev) => {
      const next = new Map(prev);
      next.set(panelValue, panelId);
      return next;
    });

    return () => {
      setMountedTabPanels((prev) => {
        // Another panel with the same value took ownership in the meantime;
        // leave its registration in place.
        if (prev.get(panelValue) !== panelId) {
          return prev;
        }

        const next = new Map(prev);
        next.delete(panelValue);
        return next;
      });
    };
  };

  // get the `id` attribute of <Tabs.Panel> to set as the value of `aria-controls` on <Tabs.Tab>
  const getTabPanelIdByValue = (tabValue: TabsTab.Value) => {
    return mountedTabPanels().get(tabValue);
  };

  // get the `id` attribute of <Tabs.Tab> to set as the value of `aria-labelledby` on <Tabs.Panel>
  const getTabIdByPanelValue = (tabPanelValue: TabsTab.Value) => {
    for (const tabMetadata of tabMap().values()) {
      if (tabPanelValue === tabMetadata.value) {
        return tabMetadata.id;
      }
    }
    return undefined;
  };

  const tabsContextValue: TabsRootContext = {
    getTabElementBySelectedValue,
    getTabIdByPanelValue,
    getTabPanelIdByValue,
    onValueChange,
    orientation,
    registerMountedTabPanel,
    setTabMap,
    tabActivationDirection,
    value,
  };

  const selectedTabMetadata = createMemo(() => {
    for (const tabMetadata of tabMap().values()) {
      if (tabMetadata.value === value()) {
        return tabMetadata;
      }
    }
    return undefined;
  });

  // Find the first non-disabled tab value.
  // Used as a fallback when the current selection is disabled or missing.
  const firstEnabledTabValue = createMemo(() => {
    for (const tabMetadata of tabMap().values()) {
      if (!tabMetadata.disabled) {
        return tabMetadata.value;
      }
    }
    return undefined;
  });

  // Implicit uncontrolled selections are still automatic changes, so notify
  // once when the tabs first register. Explicit defaults are treated as user-owned.
  let shouldNotifyInitialValueChange = !hasExplicitDefaultValueProp;
  // The disabled-default honor policy below needs a stable initial value even if
  // `defaultValue` changes after mount.
  const initialDefaultValue = defaultValueProp;
  // An explicit defaultValue can intentionally point at a disabled tab on mount.
  // Once that selection becomes valid, later disabled states should fall back.
  let shouldHonorDisabledDefaultValue = hasExplicitDefaultValueProp;
  let didRegisterTabs = false;

  // Uncontrolled roots own automatic fallback. Controlled roots keep the exact
  // value supplied by the parent, even when that tab is disabled or missing.
  createEffect(
    () => ({
      tabMap: tabMap(),
      value: value(),
      selectedTabMetadata: selectedTabMetadata(),
      firstEnabledTabValue: firstEnabledTabValue(),
    }),
    (current) => {
      if (isControlled) {
        return;
      }

      function commitAutomaticValueChange(
        fallbackValue: TabsTab.Value,
        fallbackReason: TabsRoot.ChangeEventReason,
      ) {
        // Tab values may be functions; wrap so the setter never treats them as updaters.
        setValue(() => fallbackValue);
        // Automatic fallbacks are not directional transitions; reset the direction
        // alongside the value so the batched commit keeps both in sync.
        setActivationDirectionState({
          previousValue: fallbackValue,
          tabActivationDirection: 'none',
        });
        notifyAutomaticValueChange(fallbackValue, fallbackReason);
        // Mark the initial notification as delivered only after the consumer
        // callback returns. The fallback value is queued first so automatic
        // consistency updates are not cancelable through a throwing handler.
        shouldNotifyInitialValueChange = false;
      }

      if (current.tabMap.size === 0) {
        // Tabs can be temporarily disconnected (e.g. moved within the DOM)
        // while staying registered. Don't treat that as removal.
        if (didRegisterTabs && current.value !== null && !lastKnownTabElement?.isConnected) {
          commitAutomaticValueChange(null, REASONS.missing);
        }
        return;
      }

      didRegisterTabs = true;
      lastKnownTabElement = current.tabMap.keys().next().value;

      const selectionIsDisabled = current.selectedTabMetadata?.disabled;
      const selectionIsMissing = current.selectedTabMetadata == null && current.value !== null;

      if (!selectionIsDisabled && current.value === initialDefaultValue) {
        shouldHonorDisabledDefaultValue = false;
      }

      if (
        shouldHonorDisabledDefaultValue &&
        selectionIsDisabled &&
        current.value === initialDefaultValue
      ) {
        return;
      }

      const shouldNotifyInitialValueChangeNow = shouldNotifyInitialValueChange;

      if (selectionIsDisabled || selectionIsMissing) {
        const fallbackValue = current.firstEnabledTabValue ?? null;

        if (current.value === fallbackValue) {
          // Already at the fallback value; no commit or notification needed,
          // but record that the implicit-initial transition has resolved.
          shouldNotifyInitialValueChange = false;
          return;
        }

        let fallbackReason: TabsRoot.ChangeEventReason = REASONS.missing;

        if (shouldNotifyInitialValueChangeNow) {
          fallbackReason = REASONS.initial;
        } else if (selectionIsDisabled) {
          fallbackReason = REASONS.disabled;
        }

        commitAutomaticValueChange(fallbackValue, fallbackReason);
        return;
      }

      if (shouldNotifyInitialValueChangeNow && current.selectedTabMetadata != null) {
        notifyAutomaticValueChange(current.value, REASONS.initial);
        shouldNotifyInitialValueChange = false;
      }
    },
  );

  const state: TabsRootState = {
    get orientation() {
      return orientation();
    },
    get tabActivationDirection() {
      return tabActivationDirection();
    },
  };

  return (
    <TabsRootContext value={tabsContextValue}>
      <CompositeList<TabsPanel.Metadata> elementsRef={tabPanelRefs}>
        {useRenderElement('div', componentProps, {
          state,
          props: [elementProps],
          stateAttributesMapping: tabsStateAttributesMapping,
        })}
      </CompositeList>
    </TabsRootContext>
  );
}

function findTabElement(
  tabMap: Map<Node, CompositeMetadata<TabsTab.Metadata>>,
  value: TabsTab.Value,
): HTMLElement | null {
  for (const [tabElement, tabMetadata] of tabMap.entries()) {
    if (value === tabMetadata.value) {
      return tabElement as HTMLElement;
    }
  }

  return null;
}

function computeActivationDirection(
  oldValue: TabsTab.Value | null,
  newValue: TabsTab.Value | null,
  orientation: 'horizontal' | 'vertical',
  tabMap: Map<Node, CompositeMetadata<TabsTab.Metadata>>,
): TabsTab.ActivationDirection {
  if (oldValue == null || newValue == null) {
    return 'none';
  }

  const [positionProp, backward, forward] =
    orientation === 'horizontal'
      ? (['left', 'left', 'right'] as const)
      : (['top', 'up', 'down'] as const);

  const oldTab = findTabElement(tabMap, oldValue);
  const newTab = findTabElement(tabMap, newValue);

  if (oldTab == null || newTab == null) {
    // Fallback for dynamic tabs: when a tab element isn't registered yet
    // (e.g. added and selected in the same update), infer direction from
    // the values themselves. Works for comparable types (numbers, strings).
    if (
      oldTab !== newTab &&
      (typeof oldValue === 'number' || typeof oldValue === 'string') &&
      typeof oldValue === typeof newValue
    ) {
      return newValue > oldValue ? forward : backward;
    }
    return 'none';
  }

  const oldPosition = oldTab.getBoundingClientRect()[positionProp];
  const newPosition = newTab.getBoundingClientRect()[positionProp];

  if (newPosition < oldPosition) {
    return backward;
  }
  if (newPosition > oldPosition) {
    return forward;
  }

  return 'none';
}

export type TabsRootOrientation = BaseOrientation;

export interface TabsRootState {
  /**
   * The component orientation.
   */
  orientation: TabsRoot.Orientation;
  /**
   * The direction used for tab activation.
   */
  tabActivationDirection: TabsTab.ActivationDirection;
}

export interface TabsRootProps extends BaseUIComponentProps<'div', TabsRootState> {
  /**
   * The value of the currently active `Tab`. Use when the component is controlled.
   * When the value is `null`, no Tab will be active.
   */
  value?: TabsTab.Value | undefined;
  /**
   * The default value. Use when the component is not controlled.
   * When the value is `null`, no Tab will be active.
   * @default 0
   */
  defaultValue?: TabsTab.Value | undefined;
  /**
   * The component orientation (layout flow direction).
   * @default 'horizontal'
   */
  orientation?: TabsRoot.Orientation | undefined;
  /**
   * Callback invoked when new value is being set.
   *
   * The event `reason` is `'none'` for user-initiated changes, such as a click
   * or keyboard navigation; `'initial'` for the first automatic selection or
   * fallback in uncontrolled roots when `defaultValue` is omitted or
   * `undefined`, including when the implicit initial value is disabled or
   * missing; `'disabled'` for automatic fallback when the selected tab becomes
   * disabled in uncontrolled roots; or `'missing'` for automatic fallback when
   * the selected tab is removed, or when an explicit `defaultValue` never
   * matches a mounted tab in uncontrolled roots.
   *
   * For automatic changes, the selected value can be `null` when no enabled Tab
   * is available as a fallback.
   *
   * Automatic changes cannot be canceled; calling `eventDetails.cancel()` for
   * `'initial'`, `'disabled'`, or `'missing'` has no effect.
   */
  onValueChange?:
    ((value: TabsTab.Value, eventDetails: TabsRoot.ChangeEventDetails) => void) | undefined;
}

export type TabsRootChangeEventReason =
  typeof REASONS.none | typeof REASONS.disabled | typeof REASONS.missing | typeof REASONS.initial;
export type TabsRootChangeEventDetails = BaseUIChangeEventDetails<
  TabsRoot.ChangeEventReason,
  { activationDirection: TabsTab.ActivationDirection }
>;

export namespace TabsRoot {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}
