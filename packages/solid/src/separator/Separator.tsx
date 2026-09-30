import { omit } from 'solid-js';
import type { BaseUIComponentProps, Orientation } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Separator](https://base-ui.com/react/components/separator)
 */
export function Separator(componentProps: Separator.Props) {
  const elementProps = omit(componentProps, 'className', 'class', 'render', 'orientation', 'style', 'ref');

  const orientation = () => componentProps.orientation ?? 'horizontal';

  const state: SeparatorState = {
    get orientation() {
      return orientation();
    },
  };

  return useRenderElement('div', componentProps, {
    state,
    props: [
      {
        role: 'separator',
        get 'aria-orientation'() {
          return orientation();
        },
      },
      elementProps,
    ],
  });
}

export interface SeparatorProps extends BaseUIComponentProps<'div', SeparatorState> {
  /**
   * The orientation of the separator.
   * @default 'horizontal'
   */
  orientation?: Orientation | undefined;
}

export interface SeparatorState {
  /**
   * The orientation of the separator.
   */
  orientation: Orientation;
}

export namespace Separator {
  export type Props = SeparatorProps;
  export type State = SeparatorState;
}
