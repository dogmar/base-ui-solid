import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { type TransitionStatus } from '../../internals/useTransitionStatus';
import { type BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popupStateMapping';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import * as DrawerBackdropCssVars from './DrawerBackdropCssVars';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerBackdrop(componentProps: DrawerBackdrop.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'forceRender',
  );

  const store = useDialogRootContext();

  const open = store.useState('open');
  const nested = store.useState('nested');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state: DrawerBackdropState = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: [store.context.backdropRef],
    stateAttributesMapping: popupTransitionStateMapping,
    props: [
      {
        role: 'presentation' as const,
        get hidden() {
          return !mounted();
        },
        get style() {
          return {
            'pointer-events': !open() ? ('none' as const) : undefined,
            'user-select': 'none',
            '-webkit-user-select': 'none',
            [DrawerBackdropCssVars.swipeProgress]: '0',
            [DrawerPopupCssVars.swipeStrength]: '1',
          } as JSX.CSSProperties;
        },
      },
      elementProps,
    ],
    enabled: () => (componentProps.forceRender ?? false) || !nested(),
  });
}

export interface DrawerBackdropProps extends BaseUIComponentProps<'div', DrawerBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DrawerBackdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}
