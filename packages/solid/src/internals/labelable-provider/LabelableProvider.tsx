import { createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { HTMLProps } from '../types';
import { useBaseUiId } from '../useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';

export function LabelableProvider(props: LabelableProvider.Props): JSX.Element {
  const defaultId = useBaseUiId();

  const [controlIdState, setControlIdState] = createSignal<string | null | undefined>(
    untrack(defaultId),
    { ownedWrite: true },
  );
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [messageIds, setMessageIds] = createSignal<string[]>([], { ownedWrite: true });

  // `undefined` only survives until the fallback id is assigned. Do not use `??`:
  // `null` deliberately suppresses `htmlFor`/`for`.
  const controlId = () => {
    const current = controlIdState();
    return current === undefined ? defaultId() : current;
  };

  const registrations = new Map<symbol, string | null>();

  const parentContext = useLabelableContext();
  const parentMessageIds = parentContext.messageIds;

  const registerControlId = (source: symbol, nextId: string | null | undefined) => {
    if (nextId === undefined) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }

    setControlIdState((prev) => {
      if (registrations.size === 0) {
        // A hidden subtree keeps its DOM while its reactive scope is disposed,
        // so preserve its selected control.
        return prev;
      }

      let nextControlId: string | null | undefined;

      for (const id of registrations.values()) {
        // Keep the current selection while it is still registered, so rapid unmount/remount
        // cycles don't churn it.
        if (id === prev) {
          return prev;
        }

        if (nextControlId === undefined) {
          nextControlId = id;
        }
      }

      return nextControlId;
    });
  };

  const resetControlId = () => {
    if (registrations.size === 0) {
      setControlIdState(untrack(defaultId));
    }
  };

  const getDescriptionProps = (externalProps: HTMLProps) => {
    const ids = externalProps['aria-describedby']
      ? String(externalProps['aria-describedby']).split(' ')
      : [];
    ids.push(...parentMessageIds(), ...messageIds());

    return {
      ...externalProps,
      'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined,
    };
  };

  const contextValue: LabelableContext = {
    controlId,
    registerControlId,
    resetControlId,
    labelId,
    setLabelId,
    messageIds,
    setMessageIds,
    getDescriptionProps,
  };

  return <LabelableContext value={contextValue}>{props.children}</LabelableContext>;
}

export interface LabelableProviderState {}

export interface LabelableProviderProps {
  children?: JSX.Element;
}

export namespace LabelableProvider {
  export type State = LabelableProviderState;
  export type Props = LabelableProviderProps;
}
