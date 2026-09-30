import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { FieldItemContext } from './FieldItemContext';
import { LabelableProvider } from '../../internals/labelable-provider';

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldItem(componentProps: FieldItem.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'disabled',
    'ref',
  );

  const fieldRootContext = useFieldRootContext(false);

  const disabled = () => (fieldRootContext.disabled() || componentProps.disabled) ?? false;

  const state: FieldItemState = {
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
      return disabled();
    },
  };

  const fieldItemContext: FieldItemContext = { disabled };

  return (
    <LabelableProvider>
      <FieldItemContext value={fieldItemContext}>
        {useRenderElement('div', componentProps, {
          ref: componentProps.ref,
          state,
          props: [elementProps],
          stateAttributesMapping: fieldValidityMapping,
        })}
      </FieldItemContext>
    </LabelableProvider>
  );
}

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
