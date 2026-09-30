import { createMemo, createRenderEffect, createSignal, omit, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useSelectFloatingContext, useSelectRootContext } from '../root/SelectRootContext';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  useAnchorPositioning,
  type Align,
  type Side,
  type UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import { SelectPositionerContext } from './SelectPositionerContext';
import { InternalBackdrop } from '../../utils/InternalBackdrop';
import { DROPDOWN_COLLISION_AVOIDANCE } from '../../internals/constants';
import { clearStyles } from '../popup/utils';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { findItemIndex } from '../../internals/itemEquality';
import { usePositioner } from '../../utils/usePositioner';
import { useAnchoredPopupScrollLock } from '../../utils/useAnchoredPopupScrollLock';
import { createRef } from '../../solid-utils/refs';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

const FIXED: JSX.CSSProperties = { position: 'fixed' };

/**
 * Positions the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPositioner(componentProps: SelectPositioner.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'anchor',
    'className',
    'class',
    'render',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
    'alignItemWithTrigger',
    'collisionAvoidance',
    'style',
    'ref',
  );

  const alignItemWithTrigger = () => componentProps.alignItemWithTrigger ?? true;

  const store = useSelectRootContext();
  const floatingRootContext = useSelectFloatingContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const modal = store.useState('modal');
  const value = store.useState('value');
  const openMethod = store.useState('openMethod');
  const positionerElement = store.useState('positionerElement');
  const triggerElement = store.useState('triggerElement');
  const isItemEqualToValue = store.useState('isItemEqualToValue');
  const transitionStatus = store.useState('transitionStatus');

  const scrollUpArrowRef = createRef<HTMLDivElement>();
  const scrollDownArrowRef = createRef<HTMLDivElement>();

  const [controlledAlignItemWithTrigger, setControlledAlignItemWithTrigger] = createSignal(
    untrack(alignItemWithTrigger),
    { ownedWrite: true },
  );
  const alignItemWithTriggerActive = createMemo(
    () => mounted() && controlledAlignItemWithTrigger() && openMethod() !== 'touch',
  );

  createRenderEffect(
    () => ({ mounted: mounted(), alignItemWithTrigger: alignItemWithTrigger() }),
    (current) => {
      if (!current.mounted && untrack(controlledAlignItemWithTrigger) !== current.alignItemWithTrigger) {
        setControlledAlignItemWithTrigger(current.alignItemWithTrigger);
      }
    },
  );

  createRenderEffect(alignItemWithTriggerActive, (active) => {
    store.context.alignItemWithTriggerActiveRef.current = active;
  });

  useAnchoredPopupScrollLock(
    () => (alignItemWithTriggerActive() || modal()) && open(),
    () => openMethod() === 'touch',
    positionerElement,
    triggerElement,
  );

  const positioning = useAnchorPositioning({
    get anchor() {
      return componentProps.anchor;
    },
    floatingRootContext,
    get positionMethod() {
      return componentProps.positionMethod;
    },
    get mounted() {
      return mounted();
    },
    get side() {
      return componentProps.side;
    },
    get sideOffset() {
      return componentProps.sideOffset;
    },
    get align() {
      return componentProps.align;
    },
    get alignOffset() {
      return componentProps.alignOffset;
    },
    get arrowPadding() {
      return componentProps.arrowPadding;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary ?? 'clipping-ancestors';
    },
    get collisionPadding() {
      return componentProps.collisionPadding;
    },
    get sticky() {
      return componentProps.sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking ?? alignItemWithTriggerActive();
    },
    get collisionAvoidance() {
      return componentProps.collisionAvoidance ?? DROPDOWN_COLLISION_AVOIDANCE;
    },
    keepMounted: true,
  });

  const renderedSide = createMemo<Side | 'none'>(() =>
    alignItemWithTriggerActive() ? 'none' : positioning.side(),
  );
  const positionerStyles = () =>
    alignItemWithTriggerActive() ? FIXED : positioning.positionerStyles();

  const state: SelectPositionerState = {
    get open() {
      return open();
    },
    get side() {
      return renderedSide();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
  };

  createRenderEffect(
    () => positioning.side(),
    (side) => {
      store.set('popupSide', side);
    },
  );

  const setPositionerElement = store.useStateSetter('positionerElement');

  const prevMapSizeRef = { current: 0 };

  const onMapChange = (map: Map<Element, { index?: number | null | undefined } | null>) => {
    if (store.context.valuesRef.current.length === 0) {
      return;
    }

    const prevSize = prevMapSizeRef.current;
    prevMapSizeRef.current = map.size;

    const eventDetails = createChangeEventDetails(REASONS.none);
    const currentValue = untrack(value);
    const equalityComparer = untrack(isItemEqualToValue);

    if (prevSize !== 0 && !store.state.multiple && currentValue !== null) {
      const selectedValueIndex = findItemIndex(
        store.context.valuesRef.current,
        currentValue,
        equalityComparer,
      );
      if (selectedValueIndex === -1) {
        const initialSelectedValue = store.context.initialValueRef.current;
        const hasInitial =
          initialSelectedValue != null &&
          findItemIndex(store.context.valuesRef.current, initialSelectedValue, equalityComparer) !==
            -1;
        const nextValue = hasInitial ? initialSelectedValue : null;
        store.context.setValue(nextValue, eventDetails);

        if (nextValue === null) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (prevSize !== 0 && store.state.multiple && Array.isArray(currentValue)) {
      const nextValue = currentValue.filter(
        (selectedItemValue) =>
          findItemIndex(store.context.valuesRef.current, selectedItemValue, equalityComparer) !== -1,
      );
      if (nextValue.length !== currentValue.length) {
        store.context.setValue(nextValue, eventDetails);

        if (nextValue.length === 0) {
          store.set('selectedIndex', null);
          store.context.selectedItemTextRef.current = null;
        }
      }
    }

    if (untrack(open) && untrack(alignItemWithTriggerActive)) {
      store.update({
        scrollUpArrowVisible: false,
        scrollDownArrowVisible: false,
      });

      const stylesToClear = { height: '' };
      clearStyles(untrack(positionerElement), stylesToClear);
      clearStyles(store.context.popupRef.current, stylesToClear);
    }
  };

  const contextValue: SelectPositionerContext = {
    ...positioning,
    side: renderedSide,
    alignItemWithTriggerActive,
    setControlledAlignItemWithTrigger,
    scrollUpArrowRef,
    scrollDownArrowRef,
  };

  return (
    <CompositeList
      elementsRef={store.context.listRef}
      labelsRef={store.context.labelsRef}
      onMapChange={onMapChange}
    >
      <SelectPositionerContext value={contextValue}>
        <IsolateChildren>
          <Show when={mounted() && modal()}>
            <InternalBackdrop inert={!open()} cutout={triggerElement()} />
          </Show>
          {usePositioner(componentProps, state, {
            get styles() {
              return positionerStyles();
            },
            get transitionStatus() {
              return transitionStatus();
            },
            props: elementProps,
            refs: [setPositionerElement],
            get hidden() {
              return !mounted();
            },
            get inert() {
              return !open();
            },
          })}
        </IsolateChildren>
      </SelectPositionerContext>
    </CompositeList>
  );
}

export interface SelectPositionerState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface SelectPositionerProps
  extends UseAnchorPositioningSharedParameters, BaseUIComponentProps<'div', SelectPositionerState> {
  /**
   * Whether the positioner overlaps the trigger so the selected item's text is aligned with the trigger's value text. This only applies to mouse input and is automatically disabled if there is not enough space.
   * @default true
   */
  alignItemWithTrigger?: boolean | undefined;
}

export namespace SelectPositioner {
  export type State = SelectPositionerState;
  export type Props = SelectPositionerProps;
}
