import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { applyRef } from '../../solid-utils/refs';

const TOOLBAR_LINK_METADATA: ToolbarRoot.ItemMetadata = {
  // Links cannot be disabled, but they still occupy a focusable composite item slot.
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarLink(componentProps: ToolbarLink.Props): JSX.Element {
  const elementProps = omit(componentProps, 'className', 'class', 'render', 'style', 'ref');

  const rootContext = useToolbarRootContext();

  const state: ToolbarLinkState = {
    get orientation() {
      return rootContext.orientation();
    },
  };

  return (
    <CompositeItem
      tag="a"
      render={componentProps.render}
      className={componentProps.className}
      class={componentProps.class}
      style={componentProps.style}
      metadata={TOOLBAR_LINK_METADATA}
      state={state}
      refs={[(el: HTMLElement | null) => applyRef(componentProps.ref, el)]}
      props={[elementProps]}
    />
  );
}

export interface ToolbarLinkState {
  /**
   * The component orientation.
   */
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarLinkProps extends BaseUIComponentProps<
  'a',
  ToolbarLinkState,
  HTMLProps<HTMLAnchorElement>
> {}

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props = ToolbarLinkProps;
}
