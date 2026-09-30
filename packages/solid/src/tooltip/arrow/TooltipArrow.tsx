import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

/**
 * Displays an element positioned against the tooltip anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipArrow(componentProps: TooltipArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const open = store.useState('open');
  const instantType = store.useState('instantType');

  const state: TooltipArrowState = {
    get open() {
      return open();
    },
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get uncentered() {
      return positioner.arrowUncentered();
    },
    get instant() {
      return instantType();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [positioner.arrowRef],
    props: [
      {
        get style() {
          return positioner.arrowStyles();
        },
        'aria-hidden': 'true',
      },
      elementProps,
    ],
    stateAttributesMapping: popupStateMapping,
  });

  // Isolated so re-resolutions of surrounding insertion scopes cannot
  // re-create the arrow element.
  return <IsolateChildren>{element}</IsolateChildren>;
}

export interface TooltipArrowState {
  /**
   * Whether the tooltip is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'delay' | 'dismiss' | 'focus' | undefined;
}

export interface TooltipArrowProps extends BaseUIComponentProps<'div', TooltipArrowState> {}

export namespace TooltipArrow {
  export type State = TooltipArrowState;
  export type Props = TooltipArrowProps;
}
