import { createRenderEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldDescription(componentProps: FieldDescription.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'id',
    'className',
    'class',
    'style',
    'ref',
  );

  const id = useBaseUiId(() =>
    typeof componentProps.id === 'string' ? componentProps.id : undefined,
  );

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { setMessageIds } = useLabelableContext();

  const state: FieldDescriptionState = {
    get touched() {
      return fieldRootContext.state.touched;
    },
    get dirty() {
      return fieldRootContext.state.dirty;
    },
    get valid() {
      return fieldRootContext.state.valid;
    },
    get filled() {
      return fieldRootContext.state.filled;
    },
    get focused() {
      return fieldRootContext.state.focused;
    },
    get disabled() {
      return (fieldRootContext.disabled() || fieldItemContext.disabled()) ?? false;
    },
  };

  createRenderEffect(
    () => id(),
    (currentId) => {
      if (!currentId) {
        return undefined;
      }

      setMessageIds((v) => v.concat(currentId));

      return () => {
        setMessageIds((v) => v.filter((item) => item !== currentId));
      };
    },
  );

  return useRenderElement('p', componentProps, {
    ref: componentProps.ref,
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescriptionState> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
