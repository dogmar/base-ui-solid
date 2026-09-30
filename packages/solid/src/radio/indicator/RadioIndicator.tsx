import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type { RadioRootState } from '../root/RadioRoot';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { createRef } from '../../solid-utils/refs';

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export function RadioIndicator(componentProps: RadioIndicator.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'keepMounted',
    'ref',
  );

  const rootState = useRadioRootContext();

  const rendered = () => rootState.checked;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const state: RadioIndicatorState = {
    get checked() {
      return rootState.checked;
    },
    get disabled() {
      return rootState.disabled;
    },
    get readOnly() {
      return rootState.readOnly;
    },
    get required() {
      return rootState.required;
    },
    get touched() {
      return rootState.touched;
    },
    get dirty() {
      return rootState.dirty;
    },
    get valid() {
      return rootState.valid;
    },
    get filled() {
      return rootState.filled;
    },
    get focused() {
      return rootState.focused;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const indicatorRef = createRef<HTMLElement>();

  const shouldRender = () => (componentProps.keepMounted ?? false) || mounted();

  useOpenChangeComplete({
    batch: true,
    get enabled() {
      return !rendered();
    },
    get open() {
      return rendered();
    },
    ref: indicatorRef,
    onComplete() {
      if (!untrack(rendered)) {
        setMounted(false);
      }
    },
  });

  return useRenderElement('span', componentProps, {
    enabled: shouldRender,
    ref: [indicatorRef],
    state,
    props: [elementProps],
    stateAttributesMapping,
  });
}

export interface RadioIndicatorProps extends BaseUIComponentProps<'span', RadioIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace RadioIndicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
