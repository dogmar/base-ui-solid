import { createRenderEffect, untrack, type Accessor } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { PopupTriggerMap } from '../../utils/popups';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useFloatingParentNodeId } from '../components/FloatingTree';
import {
  FloatingRootStore,
  type FloatingRootState as State,
} from '../components/FloatingRootStore';
import type { ReferenceType } from '../types';

export interface UseFloatingRootContextOptions {
  open?: boolean | undefined;
  onOpenChange?(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  elements?:
    | {
        reference?: ReferenceType | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
}

/**
 * Solid port of the React `useFloatingRootContext`. `options` should be a
 * reactive object (use getters for reactive values); its current values are
 * kept in sync with the returned store.
 */
export function useFloatingRootContext(options: UseFloatingRootContextOptions): FloatingRootStore {
  const floatingId: Accessor<string | undefined> = useBaseUiId();
  const nested = useFloatingParentNodeId() != null;

  const handleOpenChange = (open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    options.onOpenChange?.(open, eventDetails);
  };

  const store = untrack(
    () =>
      new FloatingRootStore({
        open: options.open ?? false,
        transitionStatus: undefined,
        onOpenChange: handleOpenChange,
        referenceElement: options.elements?.reference ?? null,
        floatingElement: options.elements?.floating ?? null,
        triggerElements: new PopupTriggerMap(),
        floatingId: floatingId(),
        syncOnly: false,
        nested,
      }),
  );

  createRenderEffect(
    () => ({
      open: options.open ?? false,
      floatingId: floatingId(),
      reference: options.elements?.reference,
      floating: options.elements?.floating,
    }),
    (current) => {
      if (process.env.NODE_ENV !== 'production') {
        if (current.reference && !isElement(current.reference)) {
          console.error(
            'Cannot pass a virtual element to the `elements.reference` option,',
            'as it must be a real DOM element. Use `context.setPositionReference()`',
            'instead.',
          );
        }
      }

      const valuesToSync = { open: current.open, floatingId: current.floatingId } as Pick<
        State,
        'open' | 'floatingId' | 'referenceElement' | 'domReferenceElement' | 'floatingElement'
      >;

      if (current.reference !== undefined) {
        valuesToSync.referenceElement = current.reference;
        valuesToSync.domReferenceElement = isElement(current.reference) ? current.reference : null;
      }

      if (current.floating !== undefined) {
        valuesToSync.floatingElement = current.floating;
      }

      store.update(valuesToSync);
    },
  );

  store.context.nested = nested;

  return store;
}
