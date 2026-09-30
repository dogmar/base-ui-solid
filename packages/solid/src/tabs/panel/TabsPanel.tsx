import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { tabsStateAttributesMapping } from '../root/stateAttributesMapping';
import { useTabsRootContext } from '../root/TabsRootContext';
import type { TabsRootState } from '../root/TabsRoot';
import type { TabsTab } from '../tab/TabsTab';
import { createRef } from '../../solid-utils/refs';
import * as TabsPanelDataAttributes from './TabsPanelDataAttributes';

const stateAttributesMapping: StateAttributesMapping<TabsPanelState> = {
  ...tabsStateAttributesMapping,
  ...transitionStatusMapping,
};

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tabs](https://base-ui.com/react/components/tabs)
 */
export function TabsPanel(componentProps: TabsPanel.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'value',
    'render',
    'keepMounted',
    'style',
    'ref',
  );

  const rootContext = useTabsRootContext();

  const keepMounted = () => componentProps.keepMounted ?? false;

  const id = useBaseUiId();

  const { ref: listItemRef, index } = useCompositeListItem();

  const open = () => componentProps.value === rootContext.value();
  const { mounted, transitionStatus, setMounted } = useTransitionStatus(open);
  const hidden = () => !mounted();

  const correspondingTabId = () => rootContext.getTabIdByPanelValue(componentProps.value);

  const state: TabsPanelState = {
    get hidden() {
      return hidden();
    },
    get orientation() {
      return rootContext.orientation();
    },
    get tabActivationDirection() {
      return rootContext.tabActivationDirection();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const panelRef = createRef<HTMLElement>();

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: panelRef,
    onComplete() {
      if (!open()) {
        setMounted(false);
      }
    },
  });

  createEffect(
    () => ({
      hidden: hidden(),
      keepMounted: keepMounted(),
      value: componentProps.value,
      id: id(),
    }),
    (current) => {
      if (current.id == null || (current.hidden && !current.keepMounted)) {
        return undefined;
      }

      return rootContext.registerMountedTabPanel(current.value, current.id);
    },
  );

  return useRenderElement('div', componentProps, {
    state,
    enabled: () => keepMounted() || mounted(),
    ref: [listItemRef, panelRef],
    props: [
      {
        get 'aria-labelledby'() {
          return correspondingTabId();
        },
        get hidden() {
          return hidden();
        },
        get id() {
          return id();
        },
        role: 'tabpanel',
        get tabindex() {
          return open() ? 0 : -1;
        },
        get inert() {
          return !open();
        },
        // Computed key: a plain literal key fails the DOM-props excess property check.
        get [TabsPanelDataAttributes.index as string]() {
          return index();
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
  });
}

export interface TabsPanelMetadata {
  id?: string | undefined;
  value: TabsTab.Value;
}

export interface TabsPanelState extends TabsRootState {
  /**
   * Whether the component is hidden.
   */
  hidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface TabsPanelProps extends BaseUIComponentProps<'div', TabsPanelState> {
  /**
   * The value of the TabPanel. It will be shown when the Tab with the corresponding value is active.
   */
  value: TabsTab.Value;
  /**
   * Whether to keep the HTML element in the DOM while the panel is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TabsPanel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}
