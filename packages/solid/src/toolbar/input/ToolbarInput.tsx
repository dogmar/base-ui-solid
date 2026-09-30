import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import type { ToolbarRoot, ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { applyRef } from '../../solid-utils/refs';

/**
 * A native input element that integrates with Toolbar keyboard navigation.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarInput(componentProps: ToolbarInput.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'focusableWhenDisabled',
    'render',
    'disabled',
    'style',
    'ref',
  );

  const rootContext = useToolbarRootContext();
  const groupContext = useToolbarGroupContext();

  const disabled = () =>
    rootContext.disabled() ||
    (groupContext?.disabled() ?? false) ||
    (componentProps.disabled ?? false);
  const focusableWhenDisabled = () => componentProps.focusableWhenDisabled ?? true;

  // The toolbar root reads this metadata to compute its `disabledIndices`.
  // (The object is stable; the fields are exposed through reactive getters.)
  const itemMetadata: ToolbarRoot.ItemMetadata = {
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
  };

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    composite: true,
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
    isNativeButton: false,
  });

  const state: ToolbarInputState = {
    get disabled() {
      return disabled();
    },
    get orientation() {
      return rootContext.orientation();
    },
    get focusable() {
      return focusableWhenDisabled();
    },
  };

  const preventWhenDisabled = (event: Event) => {
    if (disabled()) {
      event.preventDefault();
    }
  };

  const defaultProps: HTMLProps = {
    onClick: preventWhenDisabled,
    onPointerDown: preventWhenDisabled,
  };

  return (
    <CompositeItem
      tag="input"
      render={componentProps.render}
      className={componentProps.className}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata}
      state={state}
      refs={[(el: HTMLElement | null) => applyRef(componentProps.ref, el)]}
      props={[
        defaultProps,
        elementProps,
        // `focusableWhenDisabledProps` builds its keys conditionally, so it is
        // merged as a props getter on top of the merged-so-far props.
        (otherProps: HTMLProps) => mergeProps(otherProps, focusableWhenDisabledProps()),
      ]}
    />
  );
}

export interface ToolbarInputState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarInputProps extends BaseUIComponentProps<'input', ToolbarInputState> {
  /**
   * When `true` the item is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * When `true` the item remains focusable when disabled.
   * @default true
   */
  focusableWhenDisabled?: boolean | undefined;
  defaultValue?: string | number | string[] | undefined;
}

export namespace ToolbarInput {
  export type State = ToolbarInputState;
  export type Props = ToolbarInputProps;
}
