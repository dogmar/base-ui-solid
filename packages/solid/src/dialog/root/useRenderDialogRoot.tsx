import { createRenderEffect, onCleanup, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { DialogInteractions } from './useDialogRoot';
import { DialogRootContext, useDialogRootContext } from './DialogRootContext';
import { DialogStore } from '../store/DialogStore';
import type { DialogRoot, DialogRootProps } from './DialogRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  useImplicitActiveTrigger,
  useOpenStateTransitions,
  PopupHandleAttachment,
  usePopupRootStore,
  usePopupRootSync,
  type PayloadChildRenderFunction,
} from '../../utils/popups';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import { applyRef } from '../../solid-utils/refs';

export function useRenderDialogRoot<Payload>(
  mode: DialogRootMode,
  props: DialogRootProps<Payload>,
): JSX.Element {
  const isDrawer = mode === 'drawer';
  const isAlertDialog = mode === 'alert-dialog';
  const modal = () => (isAlertDialog ? true : (props.modal ?? true));
  const disablePointerDismissal = () =>
    isAlertDialog || (props.disablePointerDismissal ?? false);
  const role: 'dialog' | 'alertdialog' = isAlertDialog ? 'alertdialog' : 'dialog';

  const parentStore = useDialogRootContext(true);
  const nested = parentStore != null;

  // The store is owned by this Root instance and created exactly once. It is not tied to the handle:
  // the handle attaches to it, so swapping the handle re-attaches rather than recreating state.
  // Default values are only initial values; controlled values and root state are synced after creation.
  // Dialogs pass the popup element to Floating UI as the floating element (`treatPopupAsFloatingElement`).
  const store = usePopupRootStore(
    (floatingId, floatingNested) =>
      new DialogStore<Payload>(
        untrack(() => ({
          open: props.defaultOpen ?? false,
          openProp: props.open,
          activeTriggerId: props.defaultTriggerId ?? null,
          triggerIdProp: props.triggerId,
          modal: modal(),
          disablePointerDismissal: disablePointerDismissal(),
          nested,
          role,
        })),
        floatingId,
        floatingNested,
      ),
    true,
  );

  store.useControlledProp('openProp', () => props.open);
  store.useControlledProp('triggerIdProp', () => props.triggerId);

  store.useSyncedValues({
    get modal() {
      return modal();
    },
    get disablePointerDismissal() {
      return disablePointerDismissal();
    },
    nested,
    role,
  });
  store.useContextCallback('onOpenChange', () => props.onOpenChange);
  store.useContextCallback('onOpenChangeComplete', () => props.onOpenChangeComplete);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const payload = store.useState('payload') as () => Payload | undefined;

  usePopupRootSync(store, open);
  useImplicitActiveTrigger(store);
  const { forceUnmount } = useOpenStateTransitions(open, store);

  const actions: DialogRoot.Actions = {
    unmount: forceUnmount,
    close: () => store.setOpen(false, createChangeEventDetails(REASONS.imperativeAction)),
  };

  createRenderEffect(
    () => props.actionsRef,
    (actionsRef) => {
      if (actionsRef) {
        applyRef(actionsRef, actions);
        return () => applyRef(actionsRef, null);
      }
      return undefined;
    },
  );
  onCleanup(() => {
    const actionsRef = untrack(() => props.actionsRef);
    if (actionsRef && actionsRef.current === actions) {
      applyRef(actionsRef, null);
    }
  });

  const shouldRenderInteractions = () => open() || mounted();

  const resolveChildren = (): JSX.Element => {
    const children = untrack(() => props.children);
    if (typeof children === 'function') {
      return (children as PayloadChildRenderFunction<Payload>)({
        get payload() {
          return payload();
        },
      });
    }
    return props.children as JSX.Element;
  };

  return (
    <DialogRootContext value={store as DialogStore<unknown>}>
      <IsolateChildren>
        <Show when={props.handle}>
          {(handle) => <PopupHandleAttachment handle={handle()} store={store} />}
        </Show>
        <DialogInteractions
          store={store}
          parentContext={parentStore?.context}
          isDrawer={isDrawer}
          enabled={shouldRenderInteractions()}
        />
        {resolveChildren()}
      </IsolateChildren>
    </DialogRootContext>
  );
}

type DialogRootMode = 'dialog' | 'drawer' | 'alert-dialog';
