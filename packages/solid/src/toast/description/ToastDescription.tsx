import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastDescription(componentProps: ToastDescription.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'id',
    'children',
    'ref',
  );

  const { id, children, type, setId, content, renderOwnChildren, renderIsFunction } =
    useToastLabelPart(componentProps, 'description');

  const state: ToastDescriptionState = {
    get type() {
      return type();
    },
  };

  const element = useRenderElement('p', componentProps, {
    ref: componentProps.ref,
    state,
    props: [
      elementProps,
      {
        get id() {
          return id();
        },
        get children() {
          return children;
        },
      },
    ],
  });

  return useToastLabelElement(element, id, setId, {
    content,
    renderOwnChildren,
    renderIsFunction,
  });
}

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps extends BaseUIComponentProps<'p', ToastDescriptionState> {}

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}
