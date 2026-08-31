import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import { type CollapsibleRootState } from '../root/CollapsibleRoot';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRootState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsibleTrigger(componentProps: CollapsibleTrigger.Props): JSX.Element {
  const context = useCollapsibleRootContext();

  const elementProps = omit(
    componentProps,
    'className',
    'class',
    'disabled',
    'render',
    'nativeButton',
    'style',
    'ref',
  );


  const disabled = () => Boolean(componentProps.disabled ?? context.disabled());

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  return useRenderElement('button', componentProps, {
    state: context.state,
    ref: buttonRef,
    props: [
      {
        get 'aria-controls'() {
          return context.open() ? context.panelId() : undefined;
        },
        get 'aria-expanded'() {
          // Solid renders boolean attribute values as presence/absence; aria
          // attributes need explicit strings.
          return context.open() ? 'true' : 'false';
        },
        onClick: context.handleTrigger,
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });
}

export interface CollapsibleTriggerState extends CollapsibleRootState {}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleTriggerState> {}

export namespace CollapsibleTrigger {
  export type State = CollapsibleTriggerState;
  export type Props = CollapsibleTriggerProps;
}
