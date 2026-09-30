import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { DRAWER_CONTENT_ATTRIBUTE } from './drawerContentAttribute';

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerContent(componentProps: DrawerContent.Props): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  useDialogRootContext();

  return useRenderElement('div', componentProps, {
    props: [{ [DRAWER_CONTENT_ATTRIBUTE as string]: '' }, elementProps],
  });
}

export interface DrawerContentProps extends BaseUIComponentProps<'div', DrawerContentState> {}

export interface DrawerContentState {}

export namespace DrawerContent {
  export type Props = DrawerContentProps;
  export type State = DrawerContentState;
}
