import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useMeterRootContext } from '../root/MeterRootContext';
import type { MeterRootState } from '../root/MeterRoot';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterValue(componentProps: MeterValue.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'render',
    'children',
    'style',
    'ref',
  );

  const context = useMeterRootContext();

  return useRenderElement('span', componentProps, {
    props: [
      {
        'aria-hidden': 'true',
        // A function value: `useRenderElement`'s stable-children machinery wraps
        // it in a memo, keeping the displayed text reactive.
        children: () => {
          const childrenProp = componentProps.children;
          return typeof childrenProp === 'function'
            ? childrenProp(context.formattedValue(), context.value())
            : context.formattedValue();
        },
      },
      elementProps,
    ],
  });
}

export interface MeterValueState extends MeterRootState {}

export interface MeterValueProps extends Omit<
  BaseUIComponentProps<'span', MeterValueState>,
  'children'
> {
  children?: null | ((formattedValue: string, value: number) => JSX.Element) | undefined;
}

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props = MeterValueProps;
}
