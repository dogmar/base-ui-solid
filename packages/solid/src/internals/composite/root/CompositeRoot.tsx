import { omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@base-ui/utils/empty';
import { CompositeList, type CompositeMetadata } from '../list/CompositeList';
import { useCompositeRoot } from './useCompositeRoot';
import { CompositeRootContext } from './CompositeRootContext';
import { useRenderElement } from '../../useRenderElement';
import type { BaseUIComponentProps, BaseUIEvent } from '../../types';
import type { ModifierKey } from '../composite';
import type { CompositeGridNavigator } from './gridNavigation';
import { useDirection } from '../../direction-context/DirectionContext';
import type { StateAttributesMapping } from '../../getStateAttributesProps';
import type { Ref } from '../../../solid-utils/refs';

export function CompositeRoot<Metadata extends {}, State extends Record<string, any>>(
  componentProps: CompositeRoot.Props<Metadata, State>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'refs',
    'props',
    'state',
    'stateAttributesMapping',
    'highlightedIndex',
    'onHighlightedIndexChange',
    'orientation',
    'grid',
    'loopFocus',
    'onLoop',
    'enableHomeAndEndKeys',
    'onMapChange',
    'stopEventPropagation',
    'rootRef',
    'disabledIndices',
    'modifierKeys',
    'highlightItemOnHover',
    'tag',
  );

  const direction = useDirection();

  const {
    props: defaultProps,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    onMapChange: onMapChangeUnwrapped,
    relayKeyboardEvent,
  } = useCompositeRoot({
    get grid() {
      return componentProps.grid;
    },
    get loopFocus() {
      return componentProps.loopFocus;
    },
    get onLoop() {
      return componentProps.onLoop;
    },
    get orientation() {
      return componentProps.orientation;
    },
    get highlightedIndex() {
      return componentProps.highlightedIndex;
    },
    get onHighlightedIndexChange() {
      return componentProps.onHighlightedIndexChange;
    },
    get rootRef() {
      return componentProps.rootRef;
    },
    get stopEventPropagation() {
      return componentProps.stopEventPropagation ?? true;
    },
    get enableHomeAndEndKeys() {
      return componentProps.enableHomeAndEndKeys;
    },
    get direction() {
      return direction();
    },
    get disabledIndices() {
      return componentProps.disabledIndices;
    },
    get modifierKeys() {
      return componentProps.modifierKeys;
    },
  });

  const state = untrack(() => componentProps.state) ?? (EMPTY_OBJECT as State);
  const refs = untrack(() => componentProps.refs) ?? (EMPTY_ARRAY as Ref<HTMLElement>[]);
  const extraProps = untrack(() => componentProps.props) ?? (EMPTY_ARRAY as any[]);
  const tag = untrack(() => componentProps.tag) ?? 'div';
  const stateAttributesMapping = untrack(() => componentProps.stateAttributesMapping);

  const contextValue: CompositeRootContext = {
    highlightedIndex,
    onHighlightedIndexChange,
    highlightItemOnHover: () => componentProps.highlightItemOnHover ?? false,
    relayKeyboardEvent,
  };

  // `useRenderElement` is invoked inside the JSX children position so the
  // user's children are created under both context providers.
  return (
    <CompositeRootContext value={contextValue}>
      <CompositeList<Metadata>
        elementsRef={elementsRef}
        onMapChange={(newMap) => {
          componentProps.onMapChange?.(newMap);
          onMapChangeUnwrapped(newMap);
        }}
      >
        {useRenderElement(tag, componentProps, {
          state,
          ref: refs,
          props: [defaultProps, ...extraProps, elementProps],
          stateAttributesMapping,
        })}
      </CompositeList>
    </CompositeRootContext>
  );
}

export interface CompositeRootState {}

export interface CompositeRootProps<Metadata, State extends Record<string, any>> extends Pick<
  BaseUIComponentProps<'div', State>,
  'render' | 'className' | 'class' | 'children' | 'style'
> {
  props?: Array<Record<string, any> | (() => Record<string, any>)> | undefined;
  state?: State | undefined;
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  refs?: Ref<HTMLElement>[] | undefined;
  tag?: keyof JSX.IntrinsicElements | undefined;
  orientation?: 'horizontal' | 'vertical' | 'both' | undefined;
  grid?: CompositeGridNavigator | undefined;
  loopFocus?: boolean | undefined;
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: { current: Array<HTMLElement | null> },
      ) => number)
    | undefined;
  highlightedIndex?: number | undefined;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  enableHomeAndEndKeys?: boolean | undefined;
  onMapChange?: ((newMap: Map<Node, CompositeMetadata<Metadata>>) => void) | undefined;
  onKeyDown?: ((event: BaseUIEvent<KeyboardEvent>) => void) | undefined;
  stopEventPropagation?: boolean | undefined;
  rootRef?: Ref<HTMLElement> | undefined;
  disabledIndices?: number[] | undefined;
  modifierKeys?: ModifierKey[] | undefined;
  highlightItemOnHover?: boolean | undefined;
}

export namespace CompositeRoot {
  export type State = CompositeRootState;
  export type Props<Metadata, TState extends Record<string, any>> = CompositeRootProps<
    Metadata,
    TState
  >;
}
