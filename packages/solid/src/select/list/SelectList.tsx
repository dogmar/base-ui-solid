import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext, useSelectRootPropsContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { styleDisableScrollbar } from '../../utils/styles';
import { LIST_FUNCTIONAL_STYLES } from '../popup/utils';
import { IsolateChildren } from '../../solid-utils/isolateChildren';

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectList(componentProps: SelectList.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const store = useSelectRootContext();
  const { multiple, readOnly } = useSelectRootPropsContext();
  const { alignItemWithTriggerActive } = useSelectPositionerContext();

  const hasScrollArrows = store.useState('hasScrollArrows');
  const openMethod = store.useState('openMethod');
  const id = store.useState('id');

  const defaultProps: HTMLProps = {
    get id() {
      return `${id()}-list`;
    },
    role: 'listbox',
    get 'aria-multiselectable'() {
      return multiple() ? 'true' : undefined;
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    onScroll(event: Event) {
      store.context.scrollHandlerRef.current?.(event.currentTarget as HTMLDivElement);
    },
    get style() {
      return alignItemWithTriggerActive() ? LIST_FUNCTIONAL_STYLES : undefined;
    },
    get class() {
      return hasScrollArrows() && openMethod() !== 'touch'
        ? styleDisableScrollbar.className
        : undefined;
    },
  };

  const setListElement = store.useStateSetter('listElement');

  const element = useRenderElement('div', componentProps, {
    ref: [setListElement],
    props: [defaultProps, elementProps],
  });

  // Isolated so re-resolutions of surrounding insertion scopes cannot re-create
  // the list element (whose ref writes reactive state).
  return <IsolateChildren>{element}</IsolateChildren>;
}

export interface SelectListProps extends BaseUIComponentProps<'div', SelectListState> {}

export interface SelectListState {}

export namespace SelectList {
  export type Props = SelectListProps;
  export type State = SelectListState;
}
