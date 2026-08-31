import { createRenderEffect, onCleanup, type Accessor } from 'solid-js';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: Accessor<FieldControlRegistration['id']>,
  value: Accessor<FieldControlRegistration['value']>,
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled: Accessor<boolean> = () => true,
  name?: Accessor<FieldControlRegistration['name']>,
) {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol();

  // Re-register without unregistering first: re-registration with the same id updates the
  // form's fields Map entry in place, while a delete + re-add would move the field to the
  // end of the Map every time its value changes.
  createRenderEffect(
    () => ({ enabled: enabled(), id: id(), value: value(), name: name?.() }),
    (current) => {
      if (!current.enabled) {
        registerFieldControl(source, undefined);
        return;
      }

      const registration: FieldControlRegistration = {
        controlRef,
        getValue: getFormValueOverride,
        id: current.id,
        name: current.name,
        value: current.value,
      };

      registerFieldControl(source, registration);
    },
  );

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}
