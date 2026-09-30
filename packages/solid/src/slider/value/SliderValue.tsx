import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { formatNumber } from '@base-ui/utils/formatNumber';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderValue(componentProps: SliderValue.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'aria-live',
    'render',
    'className',
    'class',
    'children',
    'style',
    'ref',
  );

  const ariaLive = () => componentProps['aria-live'] ?? 'off';

  const { thumbMap, state, values, format, locale } = useSliderRootContext();

  const outputFor = () =>
    Array.from(thumbMap().values(), ({ inputId }) => inputId)
      .join(' ')
      .trim() || undefined;

  const formattedValues = createMemo(() =>
    values().map((v) => formatNumber(v, locale(), format())),
  );

  const defaultDisplayValue = () => formattedValues().join(' – ');

  return useRenderElement('output', componentProps, {
    state,
    ref: componentProps.ref,
    props: [
      {
        // off by default because it will keep announcing when the slider is being dragged
        // and also when the value is changing (but not yet committed)
        get 'aria-live'() {
          return ariaLive();
        },
        // Read once by `useRenderElement`'s stable-children machinery; the
        // thunk stays live so the display text tracks value/format changes.
        get children() {
          return () => {
            const children = componentProps.children;
            return typeof children === 'function'
              ? children(formattedValues(), values())
              : defaultDisplayValue();
          };
        },
        get for() {
          return outputFor();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export interface SliderValueState extends SliderRootState {}

export interface SliderValueProps extends Omit<
  BaseUIComponentProps<'output', SliderValueState>,
  'children'
> {
  children?:
    | null
    | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element)
    | undefined;
}

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props = SliderValueProps;
}
