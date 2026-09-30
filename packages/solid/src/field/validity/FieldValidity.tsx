import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { getCombinedFieldValidityData } from '../utils/getCombinedFieldValidityData';
import type { FieldValidityData } from '../root/FieldRoot';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';

/**
 * Used to display a custom message based on the field's validity.
 * Requires `children` to be a function that accepts field validity state as an argument.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldValidity(props: FieldValidity.Props): JSX.Element {
  const { validityData, invalid } = useFieldRootContext(false);

  const combinedFieldValidityData = createMemo(() =>
    getCombinedFieldValidityData(validityData(), invalid()),
  );
  const isInvalid = () => combinedFieldValidityData().state.valid === false;
  const { transitionStatus } = useTransitionStatus(isInvalid);

  // `fieldValidityState` is handed straight to a public render prop. The memo keeps its
  // identity stable across unrelated field-state changes (focus, dirty, filled) so
  // consumers observing it don't recompute when the validity itself is unchanged.
  const fieldValidityState = createMemo<FieldValidityState>(() => {
    return {
      ...combinedFieldValidityData(),
      validity: combinedFieldValidityData().state,
      transitionStatus: transitionStatus(),
    };
  });

  return (<>{(() => props.children(fieldValidityState())) as unknown as JSX.Element}</>);
}

export interface FieldValidityState extends Omit<FieldValidityData, 'state'> {
  /**
   * The validity state.
   */
  validity: FieldValidityData['state'];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {
  /**
   * A function that accepts the field validity state as an argument.
   *
   * ```jsx
   * <Field.Validity>
   *   {(validity) => {
   *     return <div>...</div>
   *   }}
   * </Field.Validity>
   * ```
   */
  children: (state: FieldValidityState) => JSX.Element;
}

export namespace FieldValidity {
  export type State = FieldValidityState;
  export type Props = FieldValidityProps;
}
