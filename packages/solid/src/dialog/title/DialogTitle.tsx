import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { type BaseUIComponentProps } from '../../internals/types';

/**
 * A heading that labels the dialog.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogTitle(componentProps: DialogTitle.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref', 'id');

  const store = useDialogRootContext();

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  store.useSyncedValueWithCleanup('titleElementId', id);

  return useRenderElement('h2', componentProps, {
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

export interface DialogTitleProps extends BaseUIComponentProps<'h2', DialogTitleState> {}

export interface DialogTitleState {}

export namespace DialogTitle {
  export type Props = DialogTitleProps;
  export type State = DialogTitleState;
}
