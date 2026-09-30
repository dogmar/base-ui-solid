import { merge } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Orientation } from '../../internals/types';
import { Separator, type SeparatorState } from '../../separator';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarSeparator(props: ToolbarSeparator.Props): JSX.Element {
  const context = useToolbarRootContext();

  const defaultProps = {
    get orientation(): Orientation {
      return context.orientation() === 'vertical' ? 'horizontal' : 'vertical';
    },
  };

  const mergedProps = merge(defaultProps, props);

  return <Separator {...mergedProps} />;
}

export interface ToolbarSeparatorState extends SeparatorState {}

export interface ToolbarSeparatorProps extends Separator.Props {
  /**
   * The orientation of the separator. Defaults to the opposite of the toolbar's
   * orientation, so a horizontal toolbar renders vertical separators.
   */
  orientation?: Orientation | undefined;
}

export namespace ToolbarSeparator {
  export type State = ToolbarSeparatorState;
  export type Props = ToolbarSeparatorProps;
}
