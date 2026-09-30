import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastTitle(componentProps: ToastTitle.Props): JSX.Element {
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
    useToastLabelPart(componentProps, 'title');

  const state: ToastTitleState = {
    get type() {
      return type();
    },
  };

  const element = useRenderElement('h2', componentProps, {
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

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps extends BaseUIComponentProps<'h2', ToastTitleState> {}

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}
