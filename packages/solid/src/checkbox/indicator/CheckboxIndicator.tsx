import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import type { BaseUIComponentProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { createRef } from '../../solid-utils/refs';

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxIndicator(componentProps: CheckboxIndicator.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'keepMounted',
    'ref',
  );

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState.checked || rootState.indeterminate;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const indicatorRef = createRef<HTMLElement>();

  const state: CheckboxIndicatorState = {
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
    get indeterminate() {
      return rootState.indeterminate;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

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

  const baseStateAttributesMapping = getCheckboxStateAttributesMapping(rootState);

  const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
    ...baseStateAttributesMapping,
    ...transitionStatusMapping,
  };

  const shouldRender = () => (componentProps.keepMounted ?? false) || mounted();

  return useRenderElement('span', componentProps, {
    enabled: shouldRender,
    ref: [componentProps.ref, indicatorRef],
    state,
    stateAttributesMapping,
    props: [elementProps],
  });
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps extends BaseUIComponentProps<
  'span',
  CheckboxIndicatorState
> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
