import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'id',
    'ref',
  );

  const { disabled, setLegendId } = useFieldsetRootContext();

  const id = useRegisteredLabelId(
    () => (typeof componentProps.id === 'string' ? componentProps.id : undefined),
    setLegendId,
  );

  const state: FieldsetLegendState = {
    get disabled() {
      return disabled();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: componentProps.ref,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps extends BaseUIComponentProps<'div', FieldsetLegendState> {}

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props = FieldsetLegendProps;
}
