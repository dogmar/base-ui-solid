import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button/useButton';
import type { ToolbarRoot, ToolbarRootState } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { useToolbarGroupContext } from '../group/ToolbarGroupContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { applyRef, type Ref } from '../../solid-utils/refs';

/**
 * A button that can be used as-is or as a trigger for other components.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarButton(componentProps: ToolbarButton.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'disabled',
    'focusableWhenDisabled',
    'render',
    'nativeButton',
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

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get focusableWhenDisabled() {
      return focusableWhenDisabled();
    },
    get native() {
      return componentProps.nativeButton;
    },
  });

  const state: ToolbarButtonState = {
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

  const refs: Ref<HTMLElement>[] = [
    buttonRef,
    (el: HTMLElement | null) => applyRef(componentProps.ref, el),
  ];

  // When a render prop is provided (typically another Base UI component
  // like Menu.Trigger), forward `disabled` so the rendered component can
  // derive its own disabled state. For the default toolbar button, avoid
  // forwarding a `disabled` prop so focusable disabled buttons remain
  // hoverable for interactions like tooltips.
  // TODO: follow up after https://github.com/mui/base-ui/issues/1976#issuecomment-2916905663
  const renderDisabledProps = untrack(() => componentProps.render)
    ? {
        get disabled() {
          return disabled();
        },
      }
    : EMPTY_OBJECT;

  return (
    <CompositeItem
      tag="button"
      render={componentProps.render}
      className={componentProps.className}
      class={componentProps.class}
      style={componentProps.style}
      metadata={itemMetadata}
      state={state}
      refs={refs}
      props={[elementProps, renderDisabledProps, getButtonProps]}
    />
  );
}

export interface ToolbarButtonState extends ToolbarRootState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
  /**
   * Whether the component remains focusable when disabled.
   */
  focusable: boolean;
}

export interface ToolbarButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToolbarButtonState> {
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
}

export namespace ToolbarButton {
  export type State = ToolbarButtonState;
  export type Props = ToolbarButtonProps;
}
