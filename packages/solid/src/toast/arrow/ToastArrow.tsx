import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import { useRenderElement } from '../../internals/useRenderElement';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastArrow(componentProps: ToastArrow.Props): JSX.Element {
  const elementProps = omit(componentProps, 'className', 'class', 'render', 'style', 'ref');

  const positioner = useToastPositionerContext();

  const state: ToastArrowState = {
    get side() {
      return positioner.side();
    },
    get align() {
      return positioner.align();
    },
    get uncentered() {
      return positioner.arrowUncentered();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [componentProps.ref, positioner.arrowRef],
    props: [
      {
        get style() {
          return positioner.arrowStyles();
        },
        'aria-hidden': 'true',
      },
      elementProps,
    ],
  });

  // Isolated so re-resolutions of surrounding insertion scopes cannot
  // re-create the arrow element.
  return <IsolateChildren>{element}</IsolateChildren>;
}

export interface ToastArrowState {
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
}

export interface ToastArrowProps extends BaseUIComponentProps<'div', ToastArrowState> {}

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props = ToastArrowProps;
}
