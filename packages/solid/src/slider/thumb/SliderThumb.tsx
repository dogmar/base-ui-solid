import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  omit,
  onCleanup,
  untrack,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerWindow } from '@base-ui/utils/owner';
import { clamp } from '@base-ui/utils/clamp';
import { formatNumber } from '@base-ui/utils/formatNumber';
import { visuallyHidden } from '../../solid-utils/visuallyHidden';
import { applyRef, createRef, type RefInput } from '../../solid-utils/refs';
import { BaseUIComponentProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import {
  ARROW_DOWN,
  ARROW_UP,
  ARROW_RIGHT,
  ARROW_LEFT,
  HOME,
  END,
  COMPOSITE_KEYS,
  PAGE_UP,
  PAGE_DOWN,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { contains } from '../../floating-ui-react/utils/element';
import { matchesFocusVisible } from '../../floating-ui-react/utils/element';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { getMidpoint } from '../utils/getMidpoint';
import { getSliderValue } from '../utils/getSliderValue';
import { getDecimalPrecision, roundValueToStep } from '../utils/roundValueToStep';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import * as SliderThumbDataAttributes from './SliderThumbDataAttributes';

const ALL_KEYS = new Set([...COMPOSITE_KEYS, PAGE_UP, PAGE_DOWN]);

function getDefaultAriaValueText(
  values: readonly number[],
  index: number,
  format: Intl.NumberFormatOptions | undefined,
  locale: Intl.LocalesArgument | undefined,
): string | undefined {
  if (index < 0) {
    return undefined;
  }

  if (values.length === 2) {
    return `${formatNumber(values[index], locale, format)} ${index === 0 ? 'start' : 'end'} range`;
  }

  return format ? formatNumber(values[index], locale, format) : undefined;
}

function getNewValue(
  thumbValue: number,
  increment: number,
  direction: number,
  min: number,
  max: number,
): number {
  const value = thumbValue + increment * direction;
  const roundedValue = Number(
    value.toFixed(
      Math.max(
        getDecimalPrecision(thumbValue),
        getDecimalPrecision(increment),
        getDecimalPrecision(min),
      ),
    ),
  );
  return clamp(roundedValue, min, max);
}

/**
 * The draggable part of the slider at the tip of the indicator.
 * Renders a `<div>` element and a nested `<input type="range">`.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderThumb(componentProps: SliderThumb.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'children',
    'className',
    'class',
    'aria-describedby',
    'aria-label',
    'aria-labelledby',
    'aria-valuetext',
    'disabled',
    'getAriaLabel',
    'getAriaValueText',
    'id',
    'index',
    'inputRef',
    'onBlur',
    'onFocus',
    'onKeyDown',
    'tabIndex',
    'style',
    'ref',
  );

  const id = useBaseUiId(() =>
    typeof componentProps.id === 'string' ? componentProps.id : undefined,
  );

  const {
    active: activeIndex,
    lastUsedThumbIndex,
    controlRef,
    disabled: contextDisabled,
    validation,
    format,
    handleInputChange,
    inset,
    labelId,
    largeStep,
    locale,
    max,
    min,
    minStepsBetweenValues,
    form,
    name,
    orientation,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    setActive,
    setIndicatorPosition,
    state,
    step,
    thumbRefs,
    values: sliderValues,
  } = useSliderRootContext();

  const direction = useDirection();

  const disabled = () => Boolean(componentProps.disabled) || contextDisabled();
  const range = () => sliderValues().length > 1;
  const vertical = () => orientation() === 'vertical';
  const rtl = () => direction() === 'rtl';

  const { setTouched, setFocused, validationMode } = useFieldRootContext();

  const thumbRef = createRef<HTMLElement>();
  const inputRef = createRef<HTMLInputElement>();
  let restoringFocusVisible = false;

  // Attached to the `input` (not the thumb wrapper) so `event.currentTarget` is the
  // input, matching `onKeyDown`. The synthetic blur/focus dispatched while restoring
  // `:focus-visible` is internal and must not be forwarded to the user's handlers.
  const handleFocusProp = (event: FocusEvent) => {
    if (restoringFocusVisible) {
      return;
    }
    componentProps.onFocus?.(event);
  };

  const handleBlurProp = (event: FocusEvent) => {
    if (restoringFocusVisible) {
      return;
    }
    componentProps.onBlur?.(event);
  };

  const defaultInputId = useBaseUiId();
  const labelableId = useLabelableId();
  const inputId = () => (range() ? defaultInputId() : labelableId());

  const thumbMetadata = createMemo<ThumbMetadata>(() => ({
    inputId: inputId(),
  }));

  const { ref: listItemRef, index: compositeIndex } = useCompositeListItem<ThumbMetadata>({
    get metadata() {
      return thumbMetadata();
    },
  });

  const index = () => (!range() ? 0 : (componentProps.index ?? compositeIndex()));
  const last = () => index() === sliderValues().length - 1;
  const thumbValue = () => sliderValues()[index()];
  const thumbValuePercent = () => valueToPercent(thumbValue(), min(), max());

  const [positionPercent, setPositionPercent] = createSignal<number | undefined>(undefined, {
    ownedWrite: true,
  });

  const safeLastUsedThumbIndex = () =>
    lastUsedThumbIndex() >= 0 && lastUsedThumbIndex() < sliderValues().length
      ? lastUsedThumbIndex()
      : -1;

  const getInsetPosition = () => {
    const control = controlRef.current;
    const thumb = thumbRef.current;
    if (!control || !thumb) {
      return;
    }

    const thumbRect = thumb.getBoundingClientRect();
    const controlRect = control.getBoundingClientRect();

    const side = untrack(vertical) ? 'height' : 'width';
    // the total travel distance adjusted to account for the thumb size
    const controlSize = controlRect[side] - thumbRect[side];
    // px distance from the starting edge (inline-start or bottom) to the thumb center
    const thumbOffsetFromControlEdge =
      thumbRect[side] / 2 + (controlSize * untrack(thumbValuePercent)) / 100;
    const nextPositionPercent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;
    const nextInsetPosition = Number.isFinite(nextPositionPercent)
      ? nextPositionPercent
      : undefined;

    setPositionPercent(nextInsetPosition);

    if (untrack(index) === 0) {
      setIndicatorPosition((prevPosition) => [nextInsetPosition, prevPosition[1]]);
    } else if (untrack(last)) {
      setIndicatorPosition((prevPosition) => [prevPosition[0], nextInsetPosition]);
    }
  };

  createRenderEffect(
    () => inset(),
    (isInset) => {
      if (isInset) {
        queueMicrotask(getInsetPosition);
      }
    },
  );

  createRenderEffect(
    () => ({ inset: inset(), thumbValuePercent: thumbValuePercent() }),
    (current) => {
      if (current.inset) {
        getInsetPosition();
      }
    },
  );

  createEffect(
    () => inset(),
    (isInset) => {
      if (!isInset) {
        return undefined;
      }

      const control = controlRef.current;
      const thumb = thumbRef.current;

      if (!control || !thumb) {
        return undefined;
      }

      const ResizeObserverCtor = ownerWindow(control).ResizeObserver;
      if (typeof ResizeObserverCtor !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserverCtor(getInsetPosition);

      resizeObserver.observe(control);
      resizeObserver.observe(thumb);

      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  const thumbStyle = (): JSX.CSSProperties => {
    const isInset = inset();
    const percent = thumbValuePercent();

    if (!isInset && !Number.isFinite(percent)) {
      return visuallyHidden;
    }

    const isVertical = vertical();
    const isRtl = rtl();
    const startEdge = isVertical ? 'bottom' : 'inset-inline-start';
    const crossOffsetProperty = isVertical ? 'left' : 'top';

    let zIndex: number | undefined;
    if (range()) {
      if (activeIndex() === index()) {
        zIndex = 2;
      } else if (safeLastUsedThumbIndex() === index()) {
        zIndex = 1;
      }
    } else if (activeIndex() === index()) {
      zIndex = 1;
    }

    return {
      position: 'absolute',
      [startEdge]: isInset ? 'var(--position)' : `${percent}%`,
      [crossOffsetProperty]: '50%',
      translate: `${(isVertical || !isRtl ? -1 : 1) * 50}% ${(isVertical ? 1 : -1) * 50}%`,
      'z-index': zIndex,
      ...(isInset && {
        '--position': `${positionPercent() ?? 0}%`,
        // The React version also hides the thumb while server markup is
        // hydrating (`renderBeforeHydration`); the Solid port never hydrates.
        visibility: positionPercent() === undefined ? ('hidden' as const) : undefined,
      }),
    } as JSX.CSSProperties;
  };

  const cssWritingMode = (): JSX.CSSProperties['writing-mode'] => {
    if (vertical()) {
      return rtl() ? 'vertical-rl' : 'vertical-lr';
    }
    return undefined;
  };

  const ariaLabel = () => {
    const getAriaLabelProp = componentProps.getAriaLabel;
    return typeof getAriaLabelProp === 'function'
      ? getAriaLabelProp(index())
      : componentProps['aria-label'];
  };

  const internalInputProps = {
    get 'aria-label'() {
      return ariaLabel();
    },
    get 'aria-labelledby'() {
      return componentProps['aria-labelledby'] ?? (ariaLabel() == null ? labelId() : undefined);
    },
    get 'aria-describedby'() {
      return componentProps['aria-describedby'];
    },
    get 'aria-orientation'() {
      return orientation();
    },
    get 'aria-valuenow'() {
      return thumbValue();
    },
    get 'aria-valuetext'() {
      const getAriaValueTextProp = componentProps.getAriaValueText;
      return typeof getAriaValueTextProp === 'function'
        ? getAriaValueTextProp(
            formatNumber(thumbValue(), locale(), format()),
            thumbValue(),
            index(),
          )
        : (componentProps['aria-valuetext'] ??
          getDefaultAriaValueText(sliderValues(), index(), format(), locale()));
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return form();
    },
    get id() {
      return inputId();
    },
    get max() {
      return max();
    },
    get min() {
      return min();
    },
    get name() {
      return name();
    },
    onChange(event: Event) {
      const inputElement = event.currentTarget as HTMLInputElement;
      handleInputChange(inputElement.valueAsNumber, untrack(index), event);
      // Solid only re-applies the reactive `value` binding when the committed
      // value changes, so reset the DOM value to the committed state; an
      // accepted change re-applies the new value on flush. (React relies on
      // the controlled re-render instead.)
      inputElement.value = String(untrack(thumbValue) ?? '');
    },
    onFocus(event: FocusEvent) {
      const isRestoringFocusVisible = restoringFocusVisible;
      restoringFocusVisible = false;
      setActive(untrack(index));
      setFocused(true);

      if (isRestoringFocusVisible) {
        event.stopPropagation();
      }
    },
    onBlur(event: FocusEvent) {
      if (restoringFocusVisible) {
        event.stopPropagation();
        return;
      }

      setActive(-1);

      // Keep field-level blur logic from running while focus moves to another thumb
      // of the same slider, so validation doesn't commit mid-interaction.
      if (
        thumbRefs.current.some((thumb) => contains(thumb, event.relatedTarget as Element | null))
      ) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(
          getSliderValue(
            untrack(thumbValue),
            untrack(index),
            untrack(min),
            untrack(max),
            untrack(range),
            untrack(sliderValues),
          ),
        );
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if (!ALL_KEYS.has(event.key)) {
        return;
      }

      if (COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }

      const currentIndex = untrack(index);
      const currentValues = untrack(sliderValues);
      const currentThumbValue = currentValues[currentIndex];
      const currentMin = untrack(min);
      const currentMax = untrack(max);
      const currentStep = untrack(step);
      const currentLargeStep = untrack(largeStep);
      const currentMinStepsBetweenValues = untrack(minStepsBetweenValues);
      const isRange = untrack(range);
      const isRtl = untrack(rtl);

      let newValue = null;
      let keyDirection = 0;
      let increment = event.shiftKey ? currentLargeStep : currentStep;
      const roundedValue = roundValueToStep(currentThumbValue, currentStep, currentMin);
      switch (event.key) {
        case ARROW_UP:
          keyDirection = 1;
          break;
        case ARROW_RIGHT:
          keyDirection = isRtl ? -1 : 1;
          break;
        case ARROW_DOWN:
          keyDirection = -1;
          break;
        case ARROW_LEFT:
          keyDirection = isRtl ? 1 : -1;
          break;
        case PAGE_UP:
          increment = currentLargeStep;
          keyDirection = 1;
          break;
        case PAGE_DOWN:
          increment = currentLargeStep;
          keyDirection = -1;
          break;
        case END:
          newValue =
            isRange && Number.isFinite(currentValues[currentIndex + 1])
              ? currentValues[currentIndex + 1] - currentStep * currentMinStepsBetweenValues
              : currentMax;
          break;
        case HOME:
          newValue =
            isRange && Number.isFinite(currentValues[currentIndex - 1])
              ? currentValues[currentIndex - 1] + currentStep * currentMinStepsBetweenValues
              : currentMin;
          break;
        default:
          break;
      }

      if (keyDirection !== 0) {
        newValue = getNewValue(roundedValue, increment, keyDirection, currentMin, currentMax);
      }

      if (newValue !== null) {
        const input = event.currentTarget as HTMLInputElement;

        if (!matchesFocusVisible(input)) {
          restoringFocusVisible = true;
          input.blur();
          input.focus({
            preventScroll: true,
            // Show `:focus-visible` after keyboard interaction, even if the
            // thumb was previously focused by a pointer.
            focusVisible: true,
          } as FocusOptions);
        }

        handleInputChange(newValue, currentIndex, event);
        event.preventDefault();
      }
    },
    get step() {
      return step();
    },
    get style() {
      return {
        ...visuallyHidden,
        // So that VoiceOver's focus indicator matches the thumb's dimensions
        width: '100%',
        height: '100%',
        'writing-mode': cssWritingMode(),
      } as JSX.CSSProperties;
    },
    get tabindex() {
      return componentProps.tabIndex;
    },
    type: 'range',
    get value() {
      return thumbValue() ?? '';
    },
  };

  const mergedInputProps = createMemo(() =>
    mergeProps(
      internalInputProps,
      (props) => validation.getValidationProps(disabled(), props),
      {
        onFocus: handleFocusProp,
        onBlur: handleBlurProp,
        onKeyDown: componentProps.onKeyDown,
      },
    ),
  );

  const handleInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element;
    validation.inputRef.current = element;
    applyRef(
      untrack(() => componentProps.inputRef),
      element,
    );
  };
  onCleanup(() => {
    handleInputRef(null);
  });

  return useRenderElement('div', componentProps, {
    state,
    ref: [componentProps.ref, listItemRef, thumbRef],
    props: [
      {
        get [SliderThumbDataAttributes.index]() {
          return index();
        },
        get children() {
          return (
            <>
              {componentProps.children}
              <input {...(mergedInputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)} ref={handleInputRef} />
              {/* The React version renders an inline pre-hydration positioning
                  script with the last thumb for `thumbAlignment="edge"`. SSR
                  prehydration does not apply to the Solid port. */}
            </>
          );
        },
        get id() {
          return id();
        },
        onPointerDown(event: PointerEvent) {
          // Keep disabled thumbs from writing transient pointer state.
          if (untrack(disabled)) {
            return;
          }

          pressedThumbIndexRef.current = untrack(index);
          const midpoint = getMidpoint(event.currentTarget as HTMLElement, untrack(vertical));
          pressedThumbCenterOffsetRef.current =
            (untrack(vertical) ? event.clientY : event.clientX) - midpoint;
        },
        get style() {
          return thumbStyle();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
}

export interface ThumbMetadata {
  inputId: string | undefined;
}

export interface SliderThumbState extends SliderRootState {}

export interface SliderThumbProps extends Omit<
  BaseUIComponentProps<'div', SliderThumbState>,
  'onBlur' | 'onFocus' | 'onKeyDown'
> {
  /**
   * Whether the thumb should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * Ignored when `getAriaValueText` is provided.
   */
  'aria-valuetext'?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label) attribute of the `input`.
   */
  getAriaLabel?: ((index: number) => string) | null | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the `input`.
   * This is important for screen reader users.
   */
  getAriaValueText?:
    ((formattedValue: string, value: number, index: number) => string) | null | undefined;
  /**
   * The index of the thumb which corresponds to the index of its value in the
   * `value` or `defaultValue` array.
   * This prop is required to support server-side rendering for range sliders
   * with multiple thumbs.
   * @example
   * ```tsx
   * <Slider.Root value={[10, 20]}>
   *   <Slider.Thumb index={0} />
   *   <Slider.Thumb index={1} />
   * </Slider.Root>
   * ```
   */
  index?: number | undefined;
  /**
   * A ref to access the nested input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * A blur handler forwarded to the `input`.
   */
  onBlur?: ((event: FocusEvent) => void) | undefined;
  /**
   * A focus handler forwarded to the `input`.
   */
  onFocus?: ((event: FocusEvent) => void) | undefined;
  /**
   * A keydown handler forwarded to the `input`.
   */
  onKeyDown?: ((event: KeyboardEvent) => void) | undefined;
  /**
   * Optional tab index attribute forwarded to the `input`.
   */
  tabIndex?: number | undefined;
}

export namespace SliderThumb {
  export type State = SliderThumbState;
  export type Props = SliderThumbProps;
}
