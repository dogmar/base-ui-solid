import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { FieldsetRootContext, useFieldsetRootContext } from './FieldsetRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetRoot(componentProps: FieldsetRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'disabled',
    'ref',
  );

  const [legendId, setLegendId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });

  const parentContext = useFieldsetRootContext(true);
  const disabled = () => Boolean(parentContext?.disabled() || componentProps.disabled);

  const state: FieldsetRootState = {
    get disabled() {
      return disabled();
    },
  };

  const contextValue: FieldsetRootContext = {
    legendId,
    setLegendId,
    disabled,
  };

  return (
    <FieldsetRootContext value={contextValue}>
      {useRenderElement('fieldset', componentProps, {
        ref: componentProps.ref,
        state,
        props: [
          {
            get 'aria-labelledby'() {
              return legendId();
            },
            get disabled() {
              return disabled();
            },
          },
          elementProps,
        ],
      })}
    </FieldsetRootContext>
  );
}

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootProps extends BaseUIComponentProps<'fieldset', FieldsetRootState> {}

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props = FieldsetRootProps;
}
