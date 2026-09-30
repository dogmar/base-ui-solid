import { createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionTrigger(componentProps: AccordionTrigger.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'disabled',
    'className',
    'class',
    'id',
    'render',
    'nativeButton',
    'style',
    'ref',
  );


  const collapsibleContext = useCollapsibleRootContext();

  const disabled = () => componentProps.disabled || collapsibleContext.disabled();

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const { defaultTriggerId, state, setTriggerId } = useAccordionItemContext();
  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? defaultTriggerId();

  createEffect(
    () => registeredId(),
    (currentRegisteredId) => {
      setTriggerId((currentId) =>
        currentRegisteredId ?? (currentId === null ? undefined : currentId),
      );
      return () => {
        setTriggerId((currentId) => (currentId === currentRegisteredId ? null : currentId));
      };
    },
  );

  const props = {
    get 'aria-controls'() {
      return collapsibleContext.open() ? collapsibleContext.panelId() : undefined;
    },
    get 'aria-expanded'() {
      // Solid renders boolean attribute values as presence/absence; aria
      // attributes need explicit strings.
      return collapsibleContext.open() ? 'true' : 'false';
    },
    get id() {
      return id();
    },
    onClick: collapsibleContext.handleTrigger,
  };

  return useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [props, elementProps, getButtonProps],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AccordionTriggerState> {}

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props = AccordionTriggerProps;
}
