import { createSignal, untrack } from 'solid-js';
import { EMPTY_ARRAY } from '@base-ui/utils/empty';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';
import type { RefObject } from '../solid-utils/refs';

export function useCheckboxGroupParent(
  params: UseCheckboxGroupParentParameters,
): UseCheckboxGroupParentReturnValue {
  const allValues = () => params.allValues ?? (EMPTY_ARRAY as string[]);
  const value = () => params.value;
  const onValueChange = (
    nextValue: string[],
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => untrack(() => params.onValueChange)?.(nextValue, eventDetails);

  const uncontrolledStateRef = { current: untrack(value) };
  const disabledStatesRef: RefObject<Map<string, boolean>> = { current: new Map() };

  const [status, setStatus] = createSignal<'on' | 'off' | 'mixed'>('mixed', { ownedWrite: true });
  // A `Map` rather than an object: checkbox values are consumer data, and a value like
  // `constructor` would otherwise read straight off `Object.prototype`.
  // Replace only the wrapper to update reactively without cloning the growing registry.
  const [childIdsState, setChildIdsState] = createSignal(
    { registry: new Map<string, readonly string[]>() },
    { ownedWrite: true },
  );

  const checked = () => value().length === allValues().length;
  const indeterminate = () => value().length !== allValues().length && value().length > 0;

  const registerChildId = (childValue: string, childId: string) => {
    const childIds = untrack(childIdsState).registry;
    const ids = childIds.get(childValue);
    if (!ids?.includes(childId)) {
      childIds.set(childValue, ids ? ids.concat(childId) : [childId]);
      setChildIdsState({ registry: childIds });
    }

    return () => {
      const registeredIds = childIds.get(childValue);
      if (!registeredIds?.includes(childId)) {
        return;
      }

      const nextIds = registeredIds.filter((id) => id !== childId);
      if (nextIds.length === 0) {
        childIds.delete(childValue);
      } else {
        childIds.set(childValue, nextIds);
      }
      setChildIdsState({ registry: childIds });
    };
  };

  const getParentProps: UseCheckboxGroupParentReturnValue['getParentProps'] = () => ({
    indeterminate: indeterminate(),
    checked: checked(),
    // Children report their own rendered id, so a custom `id` survives and no unmounted
    // element is named.
    'aria-controls':
      allValues()
        .flatMap((v) => childIdsState().registry.get(v) ?? (EMPTY_ARRAY as readonly string[]))
        .join(' ') || undefined,
    onCheckedChange(_, eventDetails) {
      const uncontrolledState = uncontrolledStateRef.current!;
      const currentAllValues = untrack(allValues);
      const currentValue = untrack(value);

      // None except the disabled ones that are checked, which can't be changed.
      const none = currentAllValues.filter(
        (v) => disabledStatesRef.current!.get(v) && uncontrolledState.includes(v),
      );
      // "All" that are valid:
      // - any that aren't disabled
      // - disabled ones that are checked
      const all = currentAllValues.filter(
        (v) => !disabledStatesRef.current!.get(v) || uncontrolledState.includes(v),
      );

      const allOnOrOff =
        uncontrolledState.length === all.length || uncontrolledState.length === 0;

      if (allOnOrOff) {
        if (currentValue.length === all.length) {
          onValueChange(none, eventDetails);
        } else {
          onValueChange(all, eventDetails);
        }
        return;
      }

      let nextStatus: 'on' | 'off' | 'mixed' = 'mixed';
      let nextValue = uncontrolledState;

      const currentStatus = untrack(status);
      if (currentStatus === 'mixed') {
        nextStatus = 'on';
        nextValue = all;
      } else if (currentStatus === 'on') {
        nextStatus = 'off';
        nextValue = none;
      }

      onValueChange(nextValue, eventDetails);

      if (!eventDetails.isCanceled) {
        setStatus(nextStatus);
      }
    },
  });

  const getChildProps: UseCheckboxGroupParentReturnValue['getChildProps'] = (
    childValue: string,
  ) => ({
    checked: value().includes(childValue),
    onCheckedChange(nextChecked, eventDetails) {
      const newValue = untrack(value).slice();
      if (nextChecked) {
        newValue.push(childValue);
      } else {
        newValue.splice(newValue.indexOf(childValue), 1);
      }

      onValueChange(newValue, eventDetails);

      if (!eventDetails.isCanceled) {
        uncontrolledStateRef.current = newValue;
        setStatus('mixed');
      }
    },
  });

  return {
    getParentProps,
    getChildProps,
    registerChildId,
    disabledStatesRef,
  };
}

export interface UseCheckboxGroupParentParameters {
  allValues?: string[] | undefined;
  value: string[];
  onValueChange?:
    | ((
        value: string[],
        eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
      ) => void)
    | undefined;
}

export interface UseCheckboxGroupParentReturnValue {
  disabledStatesRef: RefObject<Map<string, boolean>>;
  /**
   * Reports the `id` of the element a child checkbox exposes.
   */
  registerChildId: (value: string, id: string) => () => void;
  getParentProps: () => {
    indeterminate: boolean;
    checked: boolean;
    'aria-controls': string | undefined;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
  getChildProps: (value: string) => {
    checked: boolean;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
}
