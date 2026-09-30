import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { valueToPercent } from '../../utils/valueToPercent';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
): JSX.CSSProperties & Record<string, string | undefined> {
  const styles: JSX.CSSProperties & Record<string, string | undefined> = {
    visibility:
      forceHidden || (inset && (start === undefined || (range && end === undefined)))
        ? ('hidden' as const)
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
  };

  let startValue: string = `${start ?? 0}%`;
  let sizeValue: string = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles['--start-position'] = startValue;
    startValue = 'var(--start-position)';

    if (range) {
      styles['--relative-size'] = sizeValue;
      sizeValue = 'var(--relative-size)';
    }
  }

  styles[vertical ? 'bottom' : 'inset-inline-start'] = range ? startValue : '0';
  styles[vertical ? 'height' : 'width'] = range ? sizeValue : startValue;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderIndicator(componentProps: SliderIndicator.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } =
    useSliderRootContext();

  const vertical = () => orientation() === 'vertical';
  const range = () => values().length > 1;

  // The React version force-hides the indicator while hydrating server markup
  // for inset sliders (`renderBeforeHydration`). The Solid port never
  // hydrates, so `forceHidden` is always `false`.
  const style = () =>
    getIndicatorStyles(
      vertical(),
      range(),
      inset(),
      inset() ? indicatorPosition()[0] : valueToPercent(values()[0], min(), max()),
      inset() ? indicatorPosition()[1] : valueToPercent(values()[values().length - 1], min(), max()),
      false,
    );

  return useRenderElement('div', componentProps, {
    state,
    ref: componentProps.ref,
    props: [
      {
        get ['data-base-ui-slider-indicator']() {
          return renderBeforeHydration() ? '' : undefined;
        },
        get style() {
          return style();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps extends BaseUIComponentProps<'div', SliderIndicatorState> {}

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
