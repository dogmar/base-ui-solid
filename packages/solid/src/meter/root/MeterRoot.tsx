import { createMemo, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { formatNumber } from '@base-ui/utils/formatNumber';
import { clamp } from '@base-ui/utils/clamp';
import { visuallyHidden } from '../../solid-utils/visuallyHidden';
import { MeterRootContext } from './MeterRootContext';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { valueToPercent } from '../../utils/valueToPercent';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Groups all parts of the meter and provides the value for screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterRoot(componentProps: MeterRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'format',
    'getAriaValueText',
    'locale',
    'max',
    'min',
    'value',
    'render',
    'className',
    'class',
    'children',
    'style',
    'ref',
  );

  const max = () => componentProps.max ?? 100;
  const min = () => componentProps.min ?? 0;

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const derived = createMemo(() => {
    const valueProp = componentProps.value;

    // `clamp` handles infinity, but NaN needs an explicit fallback before normalizing range
    // outputs.
    const rawPercentage = valueToPercent(valueProp, min(), max());
    const percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
    const clampedValue = clamp(Number.isNaN(valueProp) ? min() : valueProp, min(), max());

    // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow`
    // and the indicator fill. The raw value remains available as the second `getAriaValueText`
    // argument.
    const formattedValue = componentProps.format
      ? formatNumber(clampedValue, componentProps.locale, componentProps.format)
      : formatNumber(percentageValue / 100, componentProps.locale, { style: 'percent' });

    return { percentageValue, clampedValue, formattedValue };
  });

  const contextValue: MeterRootContext = {
    formattedValue: () => derived().formattedValue,
    percentageValue: () => derived().percentageValue,
    setLabelId,
    value: () => componentProps.value,
  };

  return (
    <MeterRootContext value={contextValue}>
      {(() => {
        const hiddenText = (
          <span role="presentation" style={visuallyHidden}>
            {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
          </span>
        );

        const defaultProps: HTMLProps = {
          get 'aria-labelledby'() {
            return labelId();
          },
          get 'aria-valuemax'() {
            return max();
          },
          get 'aria-valuemin'() {
            return min();
          },
          get 'aria-valuenow'() {
            return derived().clampedValue;
          },
          get 'aria-valuetext'() {
            const getAriaValueText = componentProps.getAriaValueText;
            return getAriaValueText
              ? getAriaValueText(derived().formattedValue, componentProps.value)
              : derived().formattedValue;
          },
          role: 'meter',
          // Read once by `useRenderElement`'s stable-children machinery; the
          // per-child thunks stay live so each child keeps its own reactivity.
          get children() {
            const childrenProp = componentProps.children;
            return [...(Array.isArray(childrenProp) ? childrenProp : [childrenProp]), hiddenText];
          },
        };

        return useRenderElement('div', componentProps, {
          props: [defaultProps, elementProps],
        });
      })()}
    </MeterRootContext>
  );
}

export interface MeterRootState {}

export interface MeterRootProps extends BaseUIComponentProps<'div', MeterRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the meter.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * A function that returns a string value that provides a human-readable text alternative for `aria-valuenow`, the current value of the meter.
   */
  getAriaValueText?: ((formattedValue: string, value: number) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value.
   */
  value: number;
}

export namespace MeterRoot {
  export type State = MeterRootState;
  export type Props = MeterRootProps;
}
