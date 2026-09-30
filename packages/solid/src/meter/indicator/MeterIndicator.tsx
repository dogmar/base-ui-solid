import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { BaseUIComponentProps } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot';
import { useMeterRootContext } from '../root/MeterRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterIndicator(componentProps: MeterIndicator.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const context = useMeterRootContext();

  return useRenderElement('div', componentProps, {
    props: [
      {
        get style(): JSX.CSSProperties {
          return {
            'inset-inline-start': '0',
            height: 'inherit',
            width: `${context.percentageValue()}%`,
          };
        },
      },
      elementProps,
    ],
  });
}

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
