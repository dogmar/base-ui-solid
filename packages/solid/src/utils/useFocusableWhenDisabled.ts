export interface FocusableWhenDisabledProps {
  'aria-disabled'?: 'true' | 'false' | undefined;
  disabled?: boolean | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  tabindex?: number | undefined;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: boolean | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: boolean;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: boolean | undefined;
  /**
   * @default 0
   */
  tabIndex?: number | undefined;
  /**
   * @default true
   */
  isNativeButton: boolean;
}

export interface UseFocusableWhenDisabledReturnValue {
  /**
   * Builds the props to spread. Call inside a reactive scope; keys are added
   * conditionally, matching the React implementation, so `undefined` values
   * never clobber subsequently merged props.
   */
  props: () => FocusableWhenDisabledProps;
}

/**
 * Solid port of `useFocusableWhenDisabled`. `parameters` should be a reactive
 * object (use getters for reactive values); `props()` builds a fresh props
 * object on each call.
 */
export function useFocusableWhenDisabled(
  parameters: UseFocusableWhenDisabledParameters,
): UseFocusableWhenDisabledReturnValue {
  const buildProps = (): FocusableWhenDisabledProps => {
    const {
      focusableWhenDisabled,
      disabled,
      composite = false,
      tabIndex: tabIndexProp = 0,
      isNativeButton,
    } = parameters;

    const isFocusableComposite = composite && focusableWhenDisabled !== false;
    const isNonFocusableComposite = composite && focusableWhenDisabled === false;

    // we can't explicitly assign `undefined` to any of these props because it
    // would otherwise prevent subsequently merged props from setting them
    const additionalProps = {
      // allow Tabbing away from focusableWhenDisabled elements
      onKeyDown(event: KeyboardEvent) {
        if (parameters.disabled && parameters.focusableWhenDisabled && event.key !== 'Tab') {
          event.preventDefault();
        }
      },
    } as FocusableWhenDisabledProps;

    if (!composite) {
      additionalProps.tabindex = tabIndexProp;

      if (!isNativeButton && disabled) {
        additionalProps.tabindex = focusableWhenDisabled ? tabIndexProp : -1;
      }
    }

    if (
      (isNativeButton && (focusableWhenDisabled || isFocusableComposite)) ||
      (!isNativeButton && disabled)
    ) {
      // Solid renders boolean attribute values as presence/absence; aria
      // attributes need explicit strings.
      additionalProps['aria-disabled'] = disabled ? 'true' : 'false';
    }

    if (isNativeButton && (!focusableWhenDisabled || isNonFocusableComposite)) {
      additionalProps.disabled = disabled;
    }

    return additionalProps;
  };

  return { props: buildProps };
}

export interface UseFocusableWhenDisabledState {}
