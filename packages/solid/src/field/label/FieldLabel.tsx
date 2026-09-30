import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { error } from '@base-ui/utils/error';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { useFieldItemContext } from '../item/FieldItemContext';
import { createRef } from '../../solid-utils/refs';

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldLabel(componentProps: FieldLabel.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'id',
    'nativeLabel',
    'ref',
  );

  const nativeLabel = () => componentProps.nativeLabel ?? true;

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { labelId } = useLabelableContext();

  const state: FieldLabelState = {
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

  const labelRef = createRef<HTMLElement>();
  const labelProps = useLabel({
    get id() {
      return labelId() ?? (typeof componentProps.id === 'string' ? componentProps.id : undefined);
    },
    get native() {
      return nativeLabel();
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => nativeLabel(),
      (isNativeLabel) => {
        if (!labelRef.current) {
          return;
        }

        const isLabelTag = labelRef.current.tagName === 'LABEL';

        if (isNativeLabel) {
          if (!isLabelTag) {
            error(
              '<Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
                'Rendering a non-<label> disables native label association, so `htmlFor` will not ' +
                'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.',
            );
          }
        } else if (isLabelTag) {
          error(
            '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
              'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
              'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
              '`render` prop, or set `nativeLabel` to `true`.',
          );
        }
      },
    );
  }

  return useRenderElement('label', componentProps, {
    ref: [componentProps.ref, labelRef],
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelProps extends BaseUIComponentProps<'label', FieldLabelState> {
  /**
   * Whether the component renders a native `<label>` element when replacing it via the `render` prop.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>` and `<Combobox.Trigger>`), including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label from firing on the button.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props = FieldLabelProps;
}
