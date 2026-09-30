import { createEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '@base-ui/utils/warn';
import { stopEvent } from '../../floating-ui-react/utils/event';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createRef } from '../../solid-utils/refs';
import { useOTPFieldRootContext, getOTPFieldInputState } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldInput(componentProps: OTPFieldInput.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'aria-label',
    'aria-labelledby',
    'render',
    'className',
    'class',
    'style',
    'ref',
  );

  const context = useOTPFieldRootContext();

  const { ref: listItemRef, index } = useCompositeListItem({ guess: true });
  const inputRef = createRef<HTMLInputElement>();
  const direction = useDirection();

  const slotValue = () => context.value()[index()] ?? '';
  const inputState = getOTPFieldInputState(context.state, slotValue, index);
  const slotAriaLabel = () => componentProps['aria-label'];
  const inheritedLabel = () =>
    (componentProps['aria-labelledby'] as string | undefined) ?? context.inputAriaLabelledBy();
  const ariaLabel = () => (index() === 0 ? undefined : slotAriaLabel());

  /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => ({ index: index(), slotAriaLabel: slotAriaLabel() }),
      (current) => {
        if (
          current.index !== 0 ||
          current.slotAriaLabel == null ||
          inputRef.current?.labels?.length
        ) {
          return;
        }

        warn(
          '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
        );
      },
    );
  }

  // Restores the DOM value after an edit: Solid's reactive `value` binding only
  // rewrites the input when the slot value changes, so a rejected or partially
  // applied edit must be reset manually. When a change is accepted, the binding
  // re-applies the new slot value on flush. (React relies on its controlled
  // input restoration instead.)
  function restoreDomValue(inputElement: HTMLInputElement) {
    inputElement.value = untrack(slotValue);
  }

  const inputProps = {
    get id() {
      return context.getInputId(index());
    },
    get value() {
      return slotValue();
    },
    get type() {
      return context.mask() ? 'password' : 'text';
    },
    get inputmode() {
      return context.inputMode();
    },
    get autocomplete() {
      return index() === 0 ? context.autoComplete() : 'off';
    },
    autocorrect: 'off',
    spellcheck: 'false',
    get enterkeyhint() {
      return index() === context.length() - 1 ? 'done' : 'next';
    },
    // Only the first slot has a max length to avoid password manager bubbles appearing after later inputs.
    get maxlength() {
      return index() === 0 ? context.length() : undefined;
    },
    get tabindex() {
      return context.activeIndex() === index() ? 0 : -1;
    },
    get disabled() {
      return context.disabled();
    },
    get form() {
      return context.form();
    },
    get pattern() {
      return context.pattern();
    },
    get readonly() {
      return context.readOnly();
    },
    get required() {
      return context.required();
    },
    get 'aria-labelledby'() {
      return ariaLabel() == null ? inheritedLabel() : undefined;
    },
    get 'aria-invalid'() {
      return !context.disabled() && context.invalid() ? 'true' : undefined;
    },
    get 'aria-label'() {
      return ariaLabel();
    },
    onMouseDown(event: MouseEvent) {
      if (event.defaultPrevented || untrack(context.disabled)) {
        return;
      }

      event.preventDefault();
      context.focusInput(untrack(index));
    },
    onFocus(event: FocusEvent) {
      if (event.defaultPrevented || untrack(context.disabled)) {
        return;
      }

      context.handleInputFocus(untrack(index), event);
    },
    onBlur(event: FocusEvent) {
      if (event.defaultPrevented) {
        return;
      }

      context.handleInputBlur(event);
    },
    onInput(event: Event) {
      const inputElement = event.currentTarget as HTMLInputElement;

      if (event.defaultPrevented || untrack(context.disabled) || untrack(context.readOnly)) {
        // React restores the controlled value even when the change handler bails out.
        restoreDomValue(inputElement);
        return;
      }

      const rawValue = inputElement.value;
      const currentIndex = untrack(index);
      const currentValue = untrack(context.value);
      const currentSlotValue = untrack(slotValue);
      const currentLength = untrack(context.length);
      const currentValidationType = untrack(context.validationType);
      const currentNormalizeValue = untrack(context.normalizeValue);

      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
        rawValue,
        currentLength,
        currentValidationType,
        currentNormalizeValue,
      );

      if (didRejectCharacters) {
        context.reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
      }

      if (nextDigits === '') {
        if (rawValue === '') {
          context.setValue(
            removeOTPCharacter(currentValue, currentIndex),
            createChangeEventDetails(REASONS.inputClear, event),
          );
          restoreDomValue(inputElement);
        } else if (currentSlotValue !== '') {
          inputElement.value = currentSlotValue;
          inputElement.select();
        } else {
          restoreDomValue(inputElement);
        }
        return;
      }

      const nextValue = replaceOTPValue(
        currentValue,
        currentIndex,
        nextDigits,
        currentLength,
        currentValidationType,
        currentNormalizeValue,
      );

      const committedValue = context.setValue(
        nextValue,
        createChangeEventDetails(REASONS.inputChange, event),
      );

      if (committedValue != null) {
        const nextInput = Math.min(currentIndex + nextDigits.length, currentLength - 1);
        context.queueFocusInput(nextInput, committedValue);
      }

      restoreDomValue(inputElement);
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || untrack(context.disabled)) {
        return;
      }

      const currentIndex = untrack(index);
      const currentValue = untrack(context.value);
      const currentSlotValue = untrack(slotValue);
      const currentLength = untrack(context.length);

      const firstIndex = 0;
      const lastIndex = Math.max(currentLength - 1, firstIndex);
      const endTargetIndex = Math.min(currentValue.length, lastIndex);
      const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
      const isRtl = untrack(direction) === 'rtl';
      const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

      if (event.key === previousKey) {
        stopEvent(event);
        context.focusInput(
          hasBoundaryModifier ? firstIndex : Math.max(firstIndex, currentIndex - 1),
        );
        return;
      }

      if (event.key === nextKey) {
        stopEvent(event);
        context.focusInput(
          hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, currentIndex + 1),
        );
        return;
      }

      if (event.key === 'Home' || event.key === 'ArrowUp') {
        stopEvent(event);
        context.focusInput(firstIndex);
        return;
      }

      if (event.key === 'End' || event.key === 'ArrowDown') {
        stopEvent(event);
        context.focusInput(endTargetIndex);
        return;
      }

      if (untrack(context.readOnly)) {
        return;
      }

      function setKeyboardValue(nextValue: string, targetIndex: number) {
        const committedValue = context.setValue(
          nextValue,
          createChangeEventDetails(REASONS.keyboard, event),
        );

        if (committedValue != null) {
          context.queueFocusInput(targetIndex, committedValue);
        }
      }

      if (event.key === 'Backspace' && hasBoundaryModifier) {
        stopEvent(event);
        setKeyboardValue('', firstIndex);
        return;
      }

      if (event.key === 'Delete') {
        stopEvent(event);
        setKeyboardValue(removeOTPCharacter(currentValue, currentIndex), currentIndex);
        return;
      }

      const currentTarget = event.currentTarget as HTMLInputElement;
      const inputValue = currentTarget.value;
      const fullSelection =
        currentTarget.selectionStart === 0 && currentTarget.selectionEnd === inputValue.length;

      if (event.key.length === 1 && fullSelection && currentSlotValue === event.key) {
        stopEvent(event);
        if (currentIndex < currentLength - 1) {
          context.focusInput(currentIndex + 1);
        }
        return;
      }

      if (event.key === 'Backspace') {
        stopEvent(event);
        const targetIndex = Math.max(firstIndex, currentIndex - 1);
        const deleteIndex = currentSlotValue === '' ? targetIndex : currentIndex;
        setKeyboardValue(removeOTPCharacter(currentValue, deleteIndex), targetIndex);
      }
    },
    onPaste(event: ClipboardEvent) {
      if (event.defaultPrevented || untrack(context.disabled) || untrack(context.readOnly)) {
        return;
      }

      let rawValue = '';

      try {
        rawValue = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
        if (process.env.NODE_ENV !== 'production') {
          warn('<OTPField.Input> could not read clipboard text during paste handling.');
        }

        return;
      }

      event.preventDefault();

      const currentIndex = untrack(index);
      const currentValue = untrack(context.value);
      const currentLength = untrack(context.length);
      const currentValidationType = untrack(context.validationType);
      const currentNormalizeValue = untrack(context.normalizeValue);

      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
        rawValue,
        currentLength,
        currentValidationType,
        currentNormalizeValue,
      );

      if (didRejectCharacters) {
        context.reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputPaste, event));
      }

      if (nextDigits === '') {
        return;
      }

      const committedValue = context.setValue(
        replaceOTPValue(
          currentValue,
          currentIndex,
          nextDigits,
          currentLength,
          currentValidationType,
          currentNormalizeValue,
        ),
        createChangeEventDetails(REASONS.inputPaste, event),
      );

      if (committedValue != null) {
        const nextInput = Math.min(currentIndex + nextDigits.length, currentLength - 1);
        context.queueFocusInput(nextInput, committedValue);
      }
    },
  };

  return useRenderElement('input', componentProps, {
    ref: [componentProps.ref, listItemRef, inputRef],
    state: inputState,
    props: [inputProps, elementProps],
    stateAttributesMapping: inputStateAttributesMapping,
  });
}

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export interface OTPFieldInputProps extends BaseUIComponentProps<
  'input',
  OTPFieldInputState,
  JSX.IntrinsicElements['input']
> {}

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props = OTPFieldInputProps;
}
