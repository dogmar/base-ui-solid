import { createMemo, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { formatNumber } from '@base-ui/utils/formatNumber';
import { clamp } from '@base-ui/utils/clamp';
import { visuallyHidden } from '../../solid-utils/visuallyHidden';
import { valueToPercent } from '../../utils/valueToPercent';
import { useRenderElement } from '../../internals/useRenderElement';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressRoot(componentProps: ProgressRoot.Props): JSX.Element {
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

  // `value === null` (or any non-finite value) keeps Progress indeterminate. Otherwise compute a
  // single clamped value and normalized percentage so completion status, `aria-valuenow`, the
  // formatted text, the default `aria-valuetext`, and the indicator width all stay in sync for any
  // `min`/`max` (not just the default 0–100).
  const derived = createMemo(() => {
    const value = componentProps.value;

    let status: ProgressStatus = 'indeterminate';
    let percentageValue: number | null = null;
    let clampedValue: number | null = null;
    let formattedValue = '';
    // Derived alongside `status` so the indeterminate condition is not restated anywhere else.
    let defaultAriaValueText = 'indeterminate progress';

    if (value != null && Number.isFinite(value)) {
      const rawPercentage = valueToPercent(value, min(), max());
      percentageValue = clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
      clampedValue = clamp(value, min(), max());
      status = clampedValue === max() ? 'complete' : 'progressing';
      // Format the clamped value so visible and accessible text stay in sync with `aria-valuenow`
      // and the indicator fill. The raw value remains available as the second `getAriaValueText`
      // argument.
      formattedValue = componentProps.format
        ? formatNumber(clampedValue, componentProps.locale, componentProps.format)
        : formatNumber(percentageValue / 100, componentProps.locale, { style: 'percent' });
      defaultAriaValueText = formattedValue;
    }

    return { status, percentageValue, clampedValue, formattedValue, defaultAriaValueText };
  });

  const state: ProgressRootState = {
    get status() {
      return derived().status;
    },
  };

  const contextValue: ProgressRootContext = {
    formattedValue: () => derived().formattedValue,
    percentageValue: () => derived().percentageValue,
    setLabelId,
    state,
    value: () => componentProps.value,
  };

  return (
    <ProgressRootContext value={contextValue}>
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
            return derived().clampedValue ?? undefined;
          },
          get 'aria-valuetext'() {
            const getAriaValueText = componentProps.getAriaValueText;
            return getAriaValueText
              ? getAriaValueText(derived().formattedValue, componentProps.value)
              : derived().defaultAriaValueText;
          },
          role: 'progressbar',
          // Read once by `useRenderElement`'s stable-children machinery; the
          // per-child thunks stay live so each child keeps its own reactivity.
          get children() {
            const childrenProp = componentProps.children;
            return [...(Array.isArray(childrenProp) ? childrenProp : [childrenProp]), hiddenText];
          },
        };

        return useRenderElement('div', componentProps, {
          state,
          props: [defaultProps, elementProps],
          stateAttributesMapping: progressStateAttributesMapping,
        });
      })()}
    </ProgressRootContext>
  );
}

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps extends BaseUIComponentProps<'div', ProgressRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the progress bar.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props = ProgressRootProps;
}
