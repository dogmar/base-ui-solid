import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isElement } from '@floating-ui/utils/dom';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import {
  useAnchorPositioning,
  type Side,
  type Align,
  type UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { ToastPositionerContext } from './ToastPositionerContext';
import { useFloatingRootContext } from '../../floating-ui-react';
import { NOOP } from '../../internals/noop';
import type { ToastObject } from '../useToastManager';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { usePositioner } from '../../utils/usePositioner';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as ToastRootCssVars from '../root/ToastRootCssVars';

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastPositioner(componentProps: ToastPositioner.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'toast',
    'render',
    'className',
    'class',
    'anchor',
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
    'collisionAvoidance',
    'style',
    'ref',
  );

  const store = useToastProviderContext();

  const positionerProps = () =>
    (componentProps.toast.positionerProps ?? EMPTY_OBJECT) as NonNullable<
      ToastObject<any>['positionerProps']
    >;

  const [positionerElement, setPositionerElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  const domIndex = store.useState('toastIndex', () => componentProps.toast.id);
  const visibleIndex = store.useState('toastVisibleIndex', () => componentProps.toast.id);

  const anchor = () => {
    const anchorProp = componentProps.anchor ?? positionerProps().anchor;
    return isElement(anchorProp) ? anchorProp : null;
  };

  const floatingRootContext = useFloatingRootContext({
    open: true,
    onOpenChange: NOOP,
    get elements() {
      return {
        floating: positionerElement(),
        reference: anchor(),
      };
    },
  });

  const positioning = useAnchorPositioning({
    get anchor() {
      return anchor();
    },
    get positionMethod() {
      return componentProps.positionMethod ?? positionerProps().positionMethod ?? 'absolute';
    },
    floatingRootContext,
    mounted: true,
    get side() {
      return componentProps.side ?? positionerProps().side ?? 'top';
    },
    get sideOffset() {
      return componentProps.sideOffset ?? positionerProps().sideOffset ?? 0;
    },
    get align() {
      return componentProps.align ?? positionerProps().align ?? 'center';
    },
    get alignOffset() {
      return componentProps.alignOffset ?? positionerProps().alignOffset ?? 0;
    },
    get collisionBoundary() {
      return (
        componentProps.collisionBoundary ?? positionerProps().collisionBoundary ??
        'clipping-ancestors'
      );
    },
    get collisionPadding() {
      return componentProps.collisionPadding ?? positionerProps().collisionPadding ?? 5;
    },
    get sticky() {
      return componentProps.sticky ?? positionerProps().sticky ?? false;
    },
    get arrowPadding() {
      return componentProps.arrowPadding ?? positionerProps().arrowPadding ?? 5;
    },
    get disableAnchorTracking() {
      return (
        componentProps.disableAnchorTracking ?? positionerProps().disableAnchorTracking ?? false
      );
    },
    keepMounted: true,
    get collisionAvoidance() {
      return (
        componentProps.collisionAvoidance ?? positionerProps().collisionAvoidance ??
        POPUP_COLLISION_AVOIDANCE
      );
    },
  });

  const state: ToastPositionerState = {
    get side() {
      return positioning.side();
    },
    get align() {
      return positioning.align();
    },
    get anchorHidden() {
      return positioning.anchorHidden();
    },
  };

  const contextValue: ToastPositionerContext = {
    side: positioning.side,
    align: positioning.align,
    arrowRef: positioning.arrowRef,
    arrowUncentered: positioning.arrowUncentered,
    arrowStyles: positioning.arrowStyles,
  };

  return (
    <ToastPositionerContext value={contextValue}>
      <IsolateChildren>
        {usePositioner(componentProps, state, {
          get styles(): JSX.CSSProperties {
            return {
              ...positioning.positionerStyles(),
              [ToastRootCssVars.index]: String(
                componentProps.toast.transitionStatus === 'ending' ? domIndex() : visibleIndex(),
              ),
            };
          },
          get transitionStatus() {
            return componentProps.toast.transitionStatus;
          },
          props: elementProps,
          refs: [componentProps.ref, setPositionerElement],
        })}
      </IsolateChildren>
    </ToastPositionerContext>
  );
}

export interface ToastPositionerState {
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface ToastPositionerProps
  extends
    BaseUIComponentProps<'div', ToastPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side' | 'anchor'> {
  /**
   * An element to position the toast against.
   */
  anchor?: Element | null | undefined;
  /**
   * Which side of the anchor element to align the toast against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
  /**
   * The toast object associated with the positioner.
   */
  toast: ToastObject<any>;
}

export namespace ToastPositioner {
  export type State = ToastPositionerState;
  export type Props = ToastPositionerProps;
}
