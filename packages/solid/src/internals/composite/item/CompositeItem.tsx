import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT, EMPTY_ARRAY } from '@base-ui/utils/empty';
import { useRenderElement } from '../../useRenderElement';
import { useCompositeItem } from './useCompositeItem';
import type { BaseUIComponentProps } from '../../types';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import type { Ref, RefInput } from '../../../solid-utils/refs';

export function CompositeItem<Metadata, State extends Record<string, any>>(
  componentProps: CompositeItem.Props<Metadata, State>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'state',
    'props',
    'refs',
    'metadata',
    'stateAttributesMapping',
    'tag',
    'ref',
  );

  const { compositeProps, compositeRef } = useCompositeItem<Metadata>({
    get metadata() {
      return componentProps.metadata;
    },
  });

  const state = untrack(() => componentProps.state) ?? (EMPTY_OBJECT as State);
  const refs = untrack(() => componentProps.refs) ?? (EMPTY_ARRAY as Ref<HTMLElement>[]);
  const extraProps = untrack(() => componentProps.props) ?? (EMPTY_ARRAY as any[]);
  const tag = untrack(() => componentProps.tag) ?? 'div';
  const stateAttributesMapping = untrack(() => componentProps.stateAttributesMapping);

  return useRenderElement(tag, componentProps, {
    state,
    // The composite ref attaches first so an outer item wins when nested items share a DOM node.
    ref: [compositeRef, ...refs],
    props: [compositeProps, ...extraProps, elementProps],
    stateAttributesMapping,
  });
}

export interface CompositeItemState {}

export interface CompositeItemProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<any, State>,
  'render' | 'className' | 'class' | 'style'
> {
  children?: JSX.Element;
  metadata?: Metadata | undefined;
  refs?: Ref<HTMLElement>[] | undefined;
  props?: Array<Record<string, any> | (() => Record<string, any>)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
  ref?: RefInput<any> | undefined;
}

export namespace CompositeItem {
  export type State = CompositeItemState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeItemProps<
    Metadata,
    TState
  >;
}
