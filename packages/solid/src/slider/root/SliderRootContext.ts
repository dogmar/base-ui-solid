import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';
import type { Orientation } from '../../internals/types';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { UseFieldValidationReturnValue } from '../../field/root/useFieldValidation';
import type { RefCallback, RefObject } from '../../solid-utils/refs';
import type { ThumbMetadata } from '../thumb/SliderThumb';
import type { SliderRoot, SliderRootState } from './SliderRoot';

export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  active: Accessor<number>;
  /**
   * The index of the most recently interacted thumb.
   */
  lastUsedThumbIndex: Accessor<number>;
  controlRef: RefObject<HTMLElement>;
  dragging: Accessor<boolean>;
  disabled: Accessor<boolean>;
  validation: UseFieldValidationReturnValue;
  /**
   * Options to format the value.
   */
  format: Accessor<Intl.NumberFormatOptions | undefined>;
  handleInputChange: (
    valueInput: number,
    index: number,
    event: KeyboardEvent | Event,
  ) => void;
  indicatorPosition: Accessor<(number | undefined)[]>;
  inset: Accessor<boolean>;
  labelId: Accessor<string | undefined>;
  rootLabelId: Accessor<string | undefined>;
  /**
   * The large step value of the slider when incrementing or decrementing while the shift key is held,
   * or when using Page-Up or Page-Down keys. Snaps to multiples of this value.
   * @default 10
   */
  largeStep: Accessor<number>;
  lastChangeReasonRef: { current: SliderRoot.ChangeEventReason };
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale: Accessor<Intl.LocalesArgument | undefined>;
  /**
   * The maximum allowed value of the slider.
   */
  max: Accessor<number>;
  /**
   * The minimum allowed value of the slider.
   */
  min: Accessor<number>;
  /**
   * The minimum steps between values in a range slider.
   */
  minStepsBetweenValues: Accessor<number>;
  form: Accessor<string | undefined>;
  name: Accessor<string | undefined>;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (
    newValue: number | readonly number[],
    data: SliderRoot.CommitEventDetails,
  ) => void;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation: Accessor<Orientation>;
  pressedThumbCenterOffsetRef: RefObject<number>;
  pressedThumbIndexRef: { current: number };
  pressedValuesRef: RefObject<readonly number[]>;
  renderBeforeHydration: Accessor<boolean>;
  registerFieldControlRef: RefCallback<Element> | null;
  setActive: (index: number) => void;
  setDragging: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIndicatorPosition: (
    value:
      | (number | undefined)[]
      | ((prev: (number | undefined)[]) => (number | undefined)[]),
  ) => void;
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  /**
   * Applies a new value through `onValueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details: SliderRoot.ChangeEventDetails) => boolean;
  state: SliderRootState;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: Accessor<number>;
  thumbCollisionBehavior: Accessor<'push' | 'swap' | 'none'>;
  thumbMap: Accessor<Map<Node, CompositeMetadata<ThumbMetadata>>>;
  thumbRefs: { current: (HTMLElement | null)[] };
  /**
   * The value(s) of the slider
   */
  values: Accessor<readonly number[]>;
}

export const SliderRootContext = createOptionalContext<SliderRootContext>();

export function useSliderRootContext() {
  const context = useOptionalContext(SliderRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.',
    );
  }
  return context;
}
