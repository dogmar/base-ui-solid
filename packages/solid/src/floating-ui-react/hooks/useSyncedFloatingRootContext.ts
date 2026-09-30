import { createRenderEffect, untrack, type Accessor } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootState, FloatingRootStore } from '../components/FloatingRootStore';

/**
 * The popup-store state fields this hook reads. The Solid popup store port
 * must expose at least these keys.
 */
export interface SyncedFloatingRootContextStoreState {
  open: boolean;
  activeTriggerElement: Element | null;
  popupElement: HTMLElement | null;
  positionerElement: HTMLElement | null;
  floatingId: string | undefined;
}

/**
 * Narrowed to the store members this hook uses so consumers do not need to provide
 * unrelated store capabilities.
 *
 * Solid port note: the React version derives this from `ReactStore`; the Solid
 * popup store is not ported yet, so this is a structural interface with the
 * same member names, where reactive reads are accessors.
 */
export interface SyncedFloatingRootContextStore<
  State extends SyncedFloatingRootContextStoreState = SyncedFloatingRootContextStoreState,
> {
  readonly context: { readonly triggerElements: PopupTriggerMap };
  readonly state: Readonly<State>;
  useState<Key extends keyof State>(key: Key): Accessor<State[Key]>;
  useSyncedValue<Key extends keyof State>(key: Key, value: Accessor<State[Key]>): void;
}

export interface UseSyncedFloatingRootContextOptions<
  State extends SyncedFloatingRootContextStoreState,
  OpenChangeEventDetails extends BaseUIChangeEventDetails<string>,
> {
  popupStore: SyncedFloatingRootContextStore<State>;
  /**
   * Whether the Popup element is passed to Floating UI as the floating element instead of the default Positioner.
   */
  treatPopupAsFloatingElement?: boolean | undefined;
  floatingRootContext?: FloatingRootStore | undefined;
  floatingId: Accessor<string | undefined>;
  nested: boolean;
  onOpenChange(open: boolean, eventDetails: OpenChangeEventDetails): void;
}

/**
 * Keeps a FloatingRootStore in sync with the provided PopupStore.
 * Uses the provided FloatingRootStore when one exists, otherwise creates one once and updates it reactively.
 */
export function useSyncedFloatingRootContext<
  State extends SyncedFloatingRootContextStoreState,
  OpenChangeEventDetails extends BaseUIChangeEventDetails<string>,
>(options: UseSyncedFloatingRootContextOptions<State, OpenChangeEventDetails>): FloatingRootStore {
  const { popupStore, floatingId, nested } = options;
  const treatPopupAsFloatingElement = untrack(() => options.treatPopupAsFloatingElement) ?? false;
  const floatingRootContextProp = untrack(() => options.floatingRootContext);

  const open = popupStore.useState('open');
  const referenceElement = popupStore.useState('activeTriggerElement');
  const floatingElement = popupStore.useState(
    treatPopupAsFloatingElement ? 'popupElement' : 'positionerElement',
  );
  const triggerElements = popupStore.context.triggerElements;

  const handleOpenChange = (openValue: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    options.onOpenChange(openValue, eventDetails as OpenChangeEventDetails);
  };

  const store =
    floatingRootContextProp ??
    untrack(
      () =>
        new FloatingRootStore({
          open: open(),
          transitionStatus: undefined,
          referenceElement: referenceElement(),
          floatingElement: floatingElement() as HTMLElement | null,
          triggerElements,
          onOpenChange: handleOpenChange,
          floatingId: floatingId(),
          syncOnly: true,
          nested,
        }),
    );

  popupStore.useSyncedValue('floatingId', floatingId as Accessor<State['floatingId']>);

  createRenderEffect(
    () => ({
      open: open(),
      floatingId: floatingId(),
      referenceElement: referenceElement(),
      floatingElement: floatingElement() as HTMLElement | null,
    }),
    (current) => {
      const valuesToSync = {
        open: current.open,
        floatingId: current.floatingId,
        referenceElement: current.referenceElement,
        floatingElement: current.floatingElement,
      } as Pick<
        FloatingRootState,
        | 'open'
        | 'floatingId'
        | 'referenceElement'
        | 'floatingElement'
        | 'domReferenceElement'
        | 'positionReference'
      >;

      if (isElement(current.referenceElement)) {
        valuesToSync.domReferenceElement = current.referenceElement;
      }

      if (store.state.positionReference === store.state.referenceElement) {
        valuesToSync.positionReference = current.referenceElement;
      }

      store.update(valuesToSync);
    },
  );

  // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
  store.context.onOpenChange = handleOpenChange;
  store.context.nested = nested;

  return store;
}
