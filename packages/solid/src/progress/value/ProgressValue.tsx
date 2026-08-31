import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useProgressRootContext } from '../root/ProgressRootContext';
import type { ProgressRootState } from '../root/ProgressRoot';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressValue(componentProps: ProgressValue.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'render',
    'children',
    'style',
    'ref',
  );

  const context = useProgressRootContext();

  // Follow `status` rather than re-deriving it: a non-finite `value` is also indeterminate, and
  // has no formatted text to show.
  const indeterminate = () => context.state.status === 'indeterminate';
  const formattedValueArg = () => (indeterminate() ? 'indeterminate' : context.formattedValue());
  const formattedValueDisplay = () => (indeterminate() ? null : context.formattedValue());

  return useRenderElement('span', componentProps, {
    state: context.state,
    props: [
      {
        'aria-hidden': 'true',
        // A function value: `useRenderElement`'s stable-children machinery wraps
        // it in a memo, keeping the displayed text reactive.
        children: () => {
          const childrenProp = componentProps.children;
          return typeof childrenProp === 'function'
            ? childrenProp(formattedValueArg(), context.value())
            : formattedValueDisplay();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressValueState extends ProgressRootState {}

export interface ProgressValueProps extends Omit<
  BaseUIComponentProps<'span', ProgressValueState>,
  'children'
> {
  children?:
    null | ((formattedValue: string | null, value: number | null) => JSX.Element) | undefined;
}

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props = ProgressValueProps;
}
