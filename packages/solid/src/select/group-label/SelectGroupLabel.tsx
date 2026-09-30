import { createRenderEffect, omit, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useSelectGroupContext } from '../group/SelectGroupContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroupLabel(componentProps: SelectGroupLabel.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'id', 'ref');

  const { setLabelId } = useSelectGroupContext();

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  createRenderEffect(
    () => id(),
    (currentId) => {
      setLabelId(currentId);
      return () => {
        setLabelId((prev) => (prev === currentId ? undefined : prev));
      };
    },
  );
  onCleanup(() => {
    const currentId = untrack(id);
    setLabelId((prev) => (prev === currentId ? undefined : prev));
  });

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        'aria-hidden': 'true',
      },
      elementProps,
    ],
  });

  return element;
}

export interface SelectGroupLabelState {}

export interface SelectGroupLabelProps extends BaseUIComponentProps<'div', SelectGroupLabelState> {}

export namespace SelectGroupLabel {
  export type State = SelectGroupLabelState;
  export type Props = SelectGroupLabelProps;
}
