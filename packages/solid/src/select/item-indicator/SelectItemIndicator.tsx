import { omit, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useSelectItemContext } from '../item/SelectItemContext';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useRenderElement } from '../../internals/useRenderElement';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { createRef } from '../../solid-utils/refs';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator(componentProps: SelectItemIndicator.Props): JSX.Element {
  const { selected } = useSelectItemContext();

  const shouldRender = () => (componentProps.keepMounted ?? false) || selected();

  return (
    <Show when={shouldRender()}>
      <Inner {...componentProps} />
    </Show>
  );
}

// Split the core implementation to avoid paying the setup costs unless the element needs to mount.
function Inner(componentProps: SelectItemIndicator.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'keepMounted',
    'ref',
  );

  const { selected } = useSelectItemContext();

  const indicatorRef = createRef<HTMLSpanElement>();

  const { transitionStatus, setMounted } = useTransitionStatus(selected);

  const state: SelectItemIndicatorState = {
    get selected() {
      return selected();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const element = useRenderElement('span', componentProps, {
    ref: [indicatorRef],
    state,
    props: [
      {
        'aria-hidden': 'true',
        children: '✔️',
      },
      elementProps,
    ],
    stateAttributesMapping: transitionStatusMapping,
  });

  useOpenChangeComplete({
    batch: true,
    get enabled() {
      return !selected();
    },
    get open() {
      return selected();
    },
    ref: indicatorRef,
    onComplete() {
      if (!untrack(selected)) {
        setMounted(false);
      }
    },
  });

  return element;
}

export interface SelectItemIndicatorState {
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicatorState
> {
  children?: JSX.Element;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
