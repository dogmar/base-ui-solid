import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * A paragraph with additional information about the dialog.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogDescription(componentProps: DialogDescription.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref', 'id');

  const store = useDialogRootContext();

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  store.useSyncedValueWithCleanup('descriptionElementId', id);

  return useRenderElement('p', componentProps, {
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

export interface DialogDescriptionProps extends BaseUIComponentProps<'p', DialogDescriptionState> {}

export interface DialogDescriptionState {}

export namespace DialogDescription {
  export type Props = DialogDescriptionProps;
  export type State = DialogDescriptionState;
}
