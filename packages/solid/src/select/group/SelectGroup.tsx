import { createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { SelectGroupContext } from './SelectGroupContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * Groups related select items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroup(componentProps: SelectGroup.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const contextValue: SelectGroupContext = {
    labelId,
    setLabelId,
  };

  return (
    <SelectGroupContext value={contextValue}>
      {useRenderElement('div', componentProps, {
        props: [
          {
            role: 'group',
            get 'aria-labelledby'() {
              return labelId();
            },
          },
          elementProps,
        ],
      })}
    </SelectGroupContext>
  );
}

export interface SelectGroupState {}

export interface SelectGroupProps extends BaseUIComponentProps<'div', SelectGroupState> {}

export namespace SelectGroup {
  export type State = SelectGroupState;
  export type Props = SelectGroupProps;
}
