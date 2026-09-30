import { createEffect, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ownerDocument } from '@base-ui/utils/owner';
import { useSelectRootContext, useSelectRootPropsContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { pressableTriggerOpenStateMapping } from '../../utils/popupStateMapping';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useRenderElement } from '../../internals/useRenderElement';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { contains, getFloatingFocusElement } from '../../floating-ui-react/utils';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import type { Side } from '../../internals/useAnchorPositioning';
import { createRef } from '../../solid-utils/refs';
import { useTimeout } from '../../solid-utils/timers';
import { IsolateChildren } from '../../solid-utils/isolateChildren';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';

const SELECTED_DELAY = 400;

const stateAttributesMapping: StateAttributesMapping<SelectTriggerState> = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [SelectTriggerDataAttributes.popupSide]: side } : null,
  value: () => null,
};

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger(componentProps: SelectTrigger.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'className',
    'class',
    'id',
    'disabled',
    'nativeButton',
    'style',
    'ref',
  );

  const {
    setTouched,
    setFocused,
    validationMode,
    validation,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useSelectRootContext();
  const rootProps = useSelectRootPropsContext();
  const disabled = () =>
    (fieldDisabled() ?? false) || rootProps.disabled() || (componentProps.disabled ?? false);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const value = store.useState('value');
  const triggerProps = store.useState('triggerProps');
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  const popupSideValue = store.useState('popupSide');
  const rootId = store.useState('id');
  const selectLabelId = store.useState('labelId');
  const hasSelectedValue = store.useState('hasSelectedValue');
  const popupSide = () => (mounted() && positionerElement() ? popupSideValue() : null);

  const id = () => componentProps.id ?? rootId();
  const ariaLabelledBy = () => resolveAriaLabelledBy(fieldLabelId(), selectLabelId());

  useLabelableId({
    get id() {
      return componentProps.id as string | undefined;
    },
  });

  const positionerRef = {
    get current() {
      return positionerElement();
    },
  };

  const triggerRef = createRef<HTMLElement>();

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const setTriggerElement = store.useStateSetter('triggerElement');

  const timeoutFocus = useTimeout();
  const timeoutMouseDown = useTimeout();
  const selectedDelayTimeout = useTimeout();

  createEffect(
    () => open(),
    (isOpen) => {
      if (isOpen) {
        // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
        // disabled briefly so releasing over either the selected item or a neighboring item doesn't
        // commit an accidental selection. SelectItem can still opt into unselected mouseup sooner
        // after a real drag over the item.
        selectedDelayTimeout.start(SELECTED_DELAY, () => {
          store.context.selectionRef.current.allowUnselectedMouseUp = true;
          store.context.selectionRef.current.allowSelectedMouseUp = true;
        });

        return () => {
          selectedDelayTimeout.clear();
        };
      }

      store.context.selectionRef.current = {
        allowSelectedMouseUp: false,
        allowUnselectedMouseUp: false,
        dragY: 0,
      };

      timeoutMouseDown.clear();

      return undefined;
    },
  );

  const defaultProps: HTMLProps = {
    get id() {
      return id();
    },
    role: 'combobox',
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    'aria-haspopup': 'listbox',
    get 'aria-controls'() {
      return open()
        ? (listElement()?.id ?? getFloatingFocusElement(positionerElement())?.id)
        : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get 'aria-readonly'() {
      return rootProps.readOnly() ? 'true' : undefined;
    },
    get 'aria-required'() {
      return rootProps.required() ? 'true' : undefined;
    },
    get tabindex() {
      return disabled() ? -1 : 0;
    },
    onFocus(event: FocusEvent) {
      setFocused(true);

      // The popup element shouldn't obscure the focused trigger.
      if (untrack(open) && store.context.alignItemWithTriggerActiveRef.current) {
        store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
      }

      // Saves a re-render on initial click: `forceMount === true` mounts
      // the items before `open === true`. We could sync those cycles better
      // without a timeout, but this is enough for now.
      timeoutFocus.start(0, () => {
        store.set('forceMount', true);
      });
    },
    onBlur(event: FocusEvent) {
      // If focus is moving into the popup, don't count it as a blur.
      if (contains(untrack(positionerElement), event.relatedTarget as Element | null)) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        validation.commit(untrack(value));
      }
    },
    onMouseDown(event: MouseEvent) {
      if (untrack(open)) {
        return;
      }

      const doc = ownerDocument(event.currentTarget as Element | null);

      function handleMouseUp(mouseEvent: MouseEvent) {
        if (!triggerRef.current) {
          return;
        }

        const mouseUpTarget = mouseEvent.target as Element | null;

        // Don't treat the release as an outside press when it lands on the trigger or inside
        // the popup positioner (or their children).
        if (
          contains(triggerRef.current, mouseUpTarget) ||
          contains(positionerRef.current, mouseUpTarget)
        ) {
          return;
        }

        if (isMouseWithinBounds(mouseEvent, triggerRef.current as HTMLElement)) {
          return;
        }

        store.context.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
      }

      // Firefox can fire this upon mousedown
      timeoutMouseDown.start(0, () => {
        doc.addEventListener('mouseup', handleMouseUp, { once: true });
      });
    },
  };

  const state: SelectTriggerState = {
    get disabled() {
      return disabled();
    },
    get touched() {
      return fieldState.touched;
    },
    get dirty() {
      return fieldState.dirty;
    },
    get valid() {
      return fieldState.valid;
    },
    get filled() {
      return fieldState.filled;
    },
    get focused() {
      return fieldState.focused;
    },
    get open() {
      return open();
    },
    get value() {
      return value();
    },
    get readOnly() {
      return rootProps.readOnly();
    },
    get popupSide() {
      return popupSide();
    },
    get placeholder() {
      return !hasSelectedValue();
    },
  };

  const element = useRenderElement('button', componentProps, {
    ref: [triggerRef, buttonRef, setTriggerElement],
    state,
    stateAttributesMapping,
    props: [
      (merged) => mergeProps(merged as HTMLProps, triggerProps()),
      defaultProps,
      elementProps,
      getButtonProps,
      (merged) => validation.getValidationProps(disabled(), merged as HTMLProps),
      // ensure nested useButton does not overwrite the combobox role:
      // <Toolbar.Button render={<Select.Trigger />} />
      { role: 'combobox' },
    ],
  });

  // Isolated so re-resolutions of surrounding insertion scopes cannot re-create
  // the trigger element (whose ref writes reactive state).
  return <IsolateChildren>{element}</IsolateChildren>;
}

export interface SelectTriggerState extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', SelectTriggerState> {
  children?: JSX.Element;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props = SelectTriggerProps;
}
