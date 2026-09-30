import type { JSX } from '@solidjs/web';
import { popupStateMapping } from './popupStateMapping';
import {
  useRenderElement,
  type UseRenderElementComponentProps,
} from '../internals/useRenderElement';
import { getDisabledMountTransitionStyles } from '../internals/getDisabledMountTransitionStyles';
import type { TransitionStatus } from '../internals/useTransitionStatus';
import type { HTMLProps } from '../internals/types';
import type { RefInput } from '../solid-utils/refs';

interface UsePositionerOptions {
  /**
   * Reactive positioner styles. Use a getter.
   */
  styles: JSX.CSSProperties;
  /**
   * Reactive transition status. Use a getter.
   */
  transitionStatus: TransitionStatus;
  props?: HTMLProps<HTMLDivElement> | Record<string, any> | undefined;
  refs?: RefInput<HTMLDivElement> | undefined;
  /**
   * Reactive. Use a getter.
   */
  hidden?: boolean | undefined;
  /**
   * Reactive. Use a getter.
   */
  inert?: boolean | undefined;
}

/**
 * Renders the shared outer Positioner element used by popup components.
 * Applies the common role, hidden state, transition styles, state attributes, and optional inert styling.
 *
 * Solid port note: `options` should be a reactive object (use getters for reactive values).
 */
export function usePositioner<State extends Record<string, any>>(
  componentProps: UseRenderElementComponentProps<State>,
  state: State,
  options: UsePositionerOptions,
) {
  return useRenderElement('div', componentProps, {
    state,
    ref: options.refs,
    props: [
      {
        role: 'presentation',
        get hidden() {
          return options.hidden;
        },
        get style(): JSX.CSSProperties {
          const style: JSX.CSSProperties = { ...options.styles };
          if (options.inert ?? false) {
            style['pointer-events'] = 'none';
          }
          return style;
        },
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(options.transitionStatus).style;
        },
      },
      options.props,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}
