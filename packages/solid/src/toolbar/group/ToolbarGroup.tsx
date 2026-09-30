import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { ToolbarGroupContext } from './ToolbarGroupContext';

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarGroup(componentProps: ToolbarGroup.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'disabled',
    'render',
    'style',
    'ref',
  );

  const rootContext = useToolbarRootContext();

  const disabled = () => rootContext.disabled() || (componentProps.disabled ?? false);

  const contextValue: ToolbarGroupContext = {
    disabled,
  };

  const state: ToolbarRootState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return rootContext.orientation();
    },
  };

  // `useRenderElement` is invoked inside the JSX children position so the
  // user's children are created under the group context provider.
  return (
    <ToolbarGroupContext value={contextValue}>
      {useRenderElement('div', componentProps, {
        state,
        props: [{ role: 'group' }, elementProps],
      })}
    </ToolbarGroupContext>
  );
}

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupProps extends BaseUIComponentProps<'div', ToolbarGroupState> {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props = ToolbarGroupProps;
}
