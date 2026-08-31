import { createMemo, createRenderEffect, createSignal, omit, For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';
import { createRef } from '../../solid-utils/refs';

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldError(componentProps: FieldError.Props): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'id',
    'className',
    'class',
    'match',
    'style',
    'ref',
  );

  const id = useBaseUiId(() =>
    typeof componentProps.id === 'string' ? componentProps.id : undefined,
  );

  const fieldRootContext = useFieldRootContext(false);
  const validityData = fieldRootContext.validityData;
  const fieldState = fieldRootContext.state;
  const name = fieldRootContext.name;
  const { setMessageIds } = useLabelableContext();

  const { errors } = useFormContext();

  const formError = () => {
    const currentName = name();
    return currentName && Object.hasOwn(errors(), currentName) ? errors()[currentName] : null;
  };
  const hasFormError = () => {
    const currentFormError = formError();
    return !!(Array.isArray(currentFormError) ? currentFormError.length : currentFormError);
  };
  const hasSpecificMatch = () => typeof componentProps.match === 'string';

  const rendered = () => {
    const match = componentProps.match;
    if (match === true) {
      return true;
    }
    if (fieldState.disabled) {
      return false;
    }
    if (typeof match === 'string') {
      return Boolean(validityData().state[match]);
    }
    return hasFormError() || validityData().state.valid === false;
  };

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  createRenderEffect(
    () => ({ rendered: rendered(), id: id() }),
    (current) => {
      if (!current.rendered || !current.id) {
        return undefined;
      }

      const currentId = current.id;
      setMessageIds((v) => v.concat(currentId));

      return () => {
        setMessageIds((v) => v.filter((item) => item !== currentId));
      };
    },
  );

  const errorRef = createRef<HTMLDivElement>();
  const [lastRenderedMessage, setLastRenderedMessage] = createSignal<string | string[] | null>(
    null,
    { ownedWrite: true },
  );
  const [lastRenderedMessageKey, setLastRenderedMessageKey] = createSignal<string | null>(null, {
    ownedWrite: true,
  });

  const error = createMemo<string | string[] | null | undefined>(() => {
    if (!hasSpecificMatch() && hasFormError()) {
      return formError();
    }
    if (validityData().errors.length > 1) {
      return validityData().errors;
    }
    return validityData().error;
  });

  const errorKey = () => {
    const currentError = error();
    return Array.isArray(currentError) ? JSON.stringify(currentError) : (currentError ?? null);
  };

  // The React version captures the last rendered message during render so the exiting
  // message stays visible while animating out.
  createRenderEffect(
    () => ({ rendered: rendered(), key: errorKey(), error: error() }),
    (current) => {
      if (current.rendered && current.key !== lastRenderedMessageKey()) {
        setLastRenderedMessageKey(current.key);
        setLastRenderedMessage(current.error ?? null);
      }
    },
  );

  const displayedError = () => (rendered() ? (error() ?? null) : lastRenderedMessage());

  useOpenChangeComplete({
    get open() {
      return rendered();
    },
    ref: errorRef,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  const state: FieldErrorState = {
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
    get disabled() {
      return fieldState.disabled;
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  return useRenderElement('div', componentProps, {
    ref: [componentProps.ref, errorRef],
    state,
    props: [
      {
        get id() {
          return id();
        },
        // Semantic children: the computed error message renders when the user
        // provides no children of their own; a user `children` entry arrives
        // through `elementProps` and wins by rightmost-entry precedence.
        get children() {
          const message = displayedError();
          if (Array.isArray(message)) {
            return (
              <Show when={message.length > 1} fallback={message[0]}>
                <ul>
                  <For each={message}>{(item) => <li>{item}</li>}</For>
                </ul>
              </Show>
            ) as JSX.Element;
          }
          return message as JSX.Element;
        },
      },
      elementProps,
    ],
    stateAttributesMapping,
    enabled: mounted,
  });
}

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps extends BaseUIComponentProps<'div', FieldErrorState> {
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
