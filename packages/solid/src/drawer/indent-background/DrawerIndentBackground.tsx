import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';

const stateAttributesMapping: StateAttributesMapping<DrawerIndentBackgroundState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};

/**
 * An element placed before `<Drawer.Indent>` to render a background layer that can be styled based on whether any drawer is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerIndentBackground(
  componentProps: DrawerIndentBackground.Props,
): JSX.Element {
  const elementProps = omit(componentProps, 'render', 'className', 'class', 'style', 'ref');

  const providerContext = useDrawerProviderContext();
  const active = () => providerContext?.active() ?? false;

  const state: DrawerIndentBackgroundState = {
    get active() {
      return active();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    props: [elementProps],
    stateAttributesMapping,
  });
}

export interface DrawerIndentBackgroundState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentBackgroundProps extends BaseUIComponentProps<
  'div',
  DrawerIndentBackgroundState
> {}

export namespace DrawerIndentBackground {
  export type State = DrawerIndentBackgroundState;
  export type Props = DrawerIndentBackgroundProps;
}
