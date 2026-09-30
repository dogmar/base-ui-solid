import { createRenderEffect, onCleanup, untrack } from 'solid-js';
import { getCombinedFieldValidityData } from '../../field/utils/getCombinedFieldValidityData';
import { useFormContext } from '../form-context/FormContext';
import type { FieldValidityData } from '../../field/root/FieldRoot';
import type { RefObject } from '../../solid-utils/refs';

export interface FieldControlRegistration {
  controlRef: RefObject<any>;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

export function useFieldControlRegistration(params: UseFieldControlRegistrationParameters) {
  const { formRef } = useFormContext();

  let activeFieldControlSource: symbol | null = null;
  let registrationValue: FieldControlRegistration | null = null;
  let initialValueCaptured = false;

  const getValueForForm = () => {
    const registration = registrationValue;
    if (!registration) {
      return undefined;
    }

    if (registration.getValue) {
      return registration.getValue();
    }

    return registration.value;
  };

  function getRegistrationValue(registration: FieldControlRegistration) {
    return registration.value === undefined ? getValueForForm() : registration.value;
  }

  const validate = () => {
    const registration = registrationValue;
    params.markedDirtyRef.current = true;

    if (!registration) {
      params.commit(untrack(() => params.validityData).value);
      return;
    }

    params.commit(getRegistrationValue(registration));
  };

  function refreshRegistration() {
    const registration = registrationValue;
    if (!registration || !registration.id) {
      return;
    }

    formRef.current.fields.set(registration.id, {
      getValue: getValueForForm,
      name: untrack(() => params.name) ?? registration.name,
      controlRef: registration.controlRef,
      validityData: getCombinedFieldValidityData(
        untrack(() => params.validityData),
        untrack(() => params.invalid),
      ),
      validate,
    });
  }

  function deleteRegistration(id = registrationValue?.id) {
    if (id) {
      formRef.current.fields.delete(id);
    }
  }

  // The baseline belongs to the field, not to a control instance: registration re-runs on every
  // value change, and a control that unmounts and remounts (or is swapped for another one) comes
  // back as a brand new registration. Capturing more than once would turn whichever value the
  // control happens to hold at that point into the initial value, so a modified field would read
  // pristine and its real initial value would read dirty. Consumers that want a fresh baseline
  // remount or key `<Field.Root>` itself.
  function captureInitialValue(registration: FieldControlRegistration) {
    if (initialValueCaptured) {
      return;
    }

    initialValueCaptured = true;
    const initialValue = getRegistrationValue(registration);

    params.setValidityData((prev) =>
      prev.initialValue === initialValue ? prev : { ...prev, initialValue },
    );
  }

  createRenderEffect(
    () => ({
      invalid: params.invalid,
      name: params.name,
      validityData: params.validityData,
    }),
    (current) => {
      const registration = registrationValue;
      if (!registration || !registration.id) {
        return;
      }

      params.setRegisteredFieldName(current.name ? undefined : registration.name);

      formRef.current.fields.set(registration.id, {
        getValue: getValueForForm,
        name: current.name ?? registration.name,
        controlRef: registration.controlRef,
        validityData: getCombinedFieldValidityData(current.validityData, current.invalid),
        validate,
      });
    },
  );

  onCleanup(() => {
    const id = registrationValue?.id;
    if (id) {
      formRef.current.fields.delete(id);
    }
  });

  const register = (source: symbol, registration: FieldControlRegistration | undefined) => {
    if (!registration) {
      if (activeFieldControlSource === source) {
        activeFieldControlSource = null;
        params.change(undefined, true);
        deleteRegistration();
        registrationValue = null;
        params.setRegisteredFieldName(undefined);
        params.registeredFieldIdRef.current = undefined;
      }
      return;
    }

    const previousId = registrationValue?.id;
    const previousSource = activeFieldControlSource;

    // Drop work owned by a replaced control, but not on first registration.
    if (previousSource && previousSource !== source) {
      params.change(undefined, true);
    }

    activeFieldControlSource = source;
    registrationValue = registration;
    if (!untrack(() => params.name)) {
      params.setRegisteredFieldName(registration.name);
    }
    params.registeredFieldIdRef.current = registration.id;

    if (previousId && previousId !== registration.id) {
      deleteRegistration(previousId);
    }

    captureInitialValue(registration);
    refreshRegistration();
  };

  return [validate, register] as const;
}

export interface UseFieldControlRegistrationParameters {
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  /**
   * Reactive when provided through a getter.
   */
  invalid: boolean;
  markedDirtyRef: { current: boolean };
  /**
   * Reactive when provided through a getter.
   */
  name: string | undefined;
  setRegisteredFieldName: (name: string | undefined) => void;
  registeredFieldIdRef: { current: string | undefined };
  setValidityData: (
    value: FieldValidityData | ((prev: FieldValidityData) => FieldValidityData),
  ) => void;
  /**
   * Reactive when provided through a getter.
   */
  validityData: FieldValidityData;
}
