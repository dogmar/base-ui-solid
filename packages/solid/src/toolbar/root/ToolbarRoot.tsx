import { createMemo, createSignal, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type {
  BaseUIComponentProps,
  Orientation as BaseOrientation,
  HTMLProps,
} from '../../internals/types';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import { applyRef } from '../../solid-utils/refs';
import { ToolbarRootContext } from './ToolbarRootContext';

/**
 * A container for grouping a set of controls, such as buttons, toggle groups, or menus.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarRoot(componentProps: ToolbarRoot.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'disabled',
    'loopFocus',
    'orientation',
    'className',
    'class',
    'render',
    'style',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  // The registered item metadata objects expose reactive `disabled` getters, so
  // `disabledIndices` recomputes both when the map itself changes and when an
  // individual item's disabled state flips.
  const [itemMap, setItemMap] = createSignal(
    new Map<Element, CompositeMetadata<ToolbarRoot.ItemMetadata>>(),
    { ownedWrite: true },
  );

  const disabledIndices = createMemo(() => {
    const output: number[] = [];
    for (const itemMetadata of itemMap().values()) {
      // Only items that are disabled and not focusable when disabled
      // are removed from roving focus.
      if (itemMetadata.disabled && !itemMetadata.focusableWhenDisabled) {
        output.push(itemMetadata.index);
      }
    }
    return output;
  });

  const toolbarRootContext: ToolbarRootContext = {
    disabled,
    orientation,
  };

  const state: ToolbarRootState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return orientation();
    },
  };

  const defaultProps: HTMLProps = {
    get 'aria-orientation'() {
      return orientation();
    },
    role: 'toolbar',
  };

  return (
    <ToolbarRootContext value={toolbarRootContext}>
      <CompositeRoot<ToolbarRoot.ItemMetadata, ToolbarRootState>
        render={componentProps.render}
        className={componentProps.className}
        class={componentProps.class}
        style={componentProps.style}
        state={state}
        refs={[(el: HTMLElement | null) => applyRef(componentProps.ref, el)]}
        props={[defaultProps, elementProps]}
        disabledIndices={disabledIndices()}
        loopFocus={componentProps.loopFocus}
        onMapChange={setItemMap}
        orientation={orientation()}
      />
    </ToolbarRootContext>
  );
}

export interface ToolbarRootItemMetadata {
  disabled: boolean;
  focusableWhenDisabled: boolean;
}

export type ToolbarRootOrientation = BaseOrientation;

export interface ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * The component orientation.
   */
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarRootProps extends BaseUIComponentProps<'div', ToolbarRootState> {
  disabled?: boolean | undefined;
  /**
   * The orientation of the toolbar.
   * @default 'horizontal'
   */
  orientation?: ToolbarRoot.Orientation | undefined;
  /**
   * If `true`, using keyboard navigation will wrap focus to the other end of the toolbar once the end is reached.
   *
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace ToolbarRoot {
  export type ItemMetadata = ToolbarRootItemMetadata;
  export type Orientation = ToolbarRootOrientation;
  export type State = ToolbarRootState;
  export type Props = ToolbarRootProps;
}
