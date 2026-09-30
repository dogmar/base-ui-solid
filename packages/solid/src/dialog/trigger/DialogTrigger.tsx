import { createMemo, omit, untrack, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import { DialogHandle } from '../store/DialogHandle';
import type { DialogHandleStore } from '../store/DialogStore';
import { usePopupHandleStore, useTriggerDataForwarding } from '../../utils/popups';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useClick } from '../../floating-ui-react';
import { useOpenMethodTriggerProps } from '../../utils/useOpenInteractionType';
import { mergeProps } from '../../merge-props';
import { createRef } from '../../solid-utils/refs';

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogTrigger<Payload = unknown>(
  componentProps: DialogTrigger.Props<Payload>,
): JSX.Element {
  const dialogRootStore = useDialogRootContext(true);
  const handleStore = usePopupHandleStore<DialogHandleStore<Payload>>(
    () => componentProps.handle,
  );

  if (untrack(() => componentProps.handle) === undefined && dialogRootStore === undefined) {
    throw new Error(
      'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
    );
  }

  // The store the trigger reads from: the handle's currently exposed store, or the root context.
  // Solid components run once, so when the handle's store pointer changes (a root attaches or
  // detaches), the store-bound trigger scope below is re-created.
  const store = createMemo(() => {
    const resolved =
      handleStore() ?? (dialogRootStore as unknown as DialogHandleStore<Payload> | undefined);
    if (!resolved) {
      throw new Error(
        'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
      );
    }
    return resolved;
  });

  return (
    <Show when={store()} keyed>
      {(currentStore) => DialogTriggerImpl(componentProps, currentStore)}
    </Show>
  );
}

function DialogTriggerImpl<Payload>(
  componentProps: DialogTrigger.Props<Payload>,
  store: DialogHandleStore<Payload>,
): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'style',
    'ref',
    'disabled',
    'nativeButton',
    'id',
    'payload',
    'handle',
  );

  const disabled = () => componentProps.disabled ?? false;

  const thisTriggerId = useBaseUiId(() => componentProps.id as string | undefined);
  const floatingContext = store.state.floatingRootContext;
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const triggerElementRef = createRef<HTMLElement>();

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    store,
    {
      get payload() {
        return componentProps.payload as Payload | undefined;
      },
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const click = useClick(floatingContext);
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store.select('open'),
    (interactionType) => {
      store.set('openMethod', interactionType);
    },
  );

  const state: DialogTriggerState = {
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);

  return useRenderElement('button', componentProps, {
    state,
    ref: [buttonRef, registerTrigger, triggerElementRef],
    props: [
      (merged) => mergeProps(merged, click.reference ?? {}),
      (merged) => mergeProps(merged, rootTriggerProps()),
      interactionTypeProps,
      {
        [CLICK_TRIGGER_IDENTIFIER as string]: '',
        get id() {
          return thisTriggerId();
        },
        'aria-haspopup': 'dialog' as const,
        get 'aria-expanded'() {
          return isOpenedByThisTrigger() ? 'true' : 'false';
        },
        get 'aria-controls'() {
          return popupId();
        },
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface DialogTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogTriggerState> {
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
  /**
   * Whether the trigger is currently disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}
