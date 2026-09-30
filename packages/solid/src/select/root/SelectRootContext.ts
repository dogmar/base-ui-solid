import type { Accessor } from 'solid-js';
import { type FloatingRootContext } from '../../floating-ui-react';
import type { SelectStore } from '../store';
import type { HTMLProps } from '../../internals/types';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

/**
 * Root values consumed during render. Keep these outside `useSyncedValues` so descendant ref
 * callbacks see the current props during the same commit.
 *
 * Solid port note: the fields are accessors so context consumers stay reactive.
 */
export interface SelectRootPropsContextValue {
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  required: Accessor<boolean>;
  multiple: Accessor<boolean>;
  highlightItemOnHover: Accessor<boolean>;
  itemProps: Accessor<HTMLProps>;
}

export const SelectRootContext = createOptionalContext<SelectStore>();
export const SelectRootPropsContext = createOptionalContext<SelectRootPropsContextValue>();
export const SelectFloatingContext = createOptionalContext<FloatingRootContext>();

export function useSelectRootContext() {
  const store = useOptionalContext(SelectRootContext);
  if (store === undefined) {
    throw new Error(
      'Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return store;
}

export function useSelectRootPropsContext() {
  const context = useOptionalContext(SelectRootPropsContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SelectRootPropsContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return context;
}

export function useSelectFloatingContext() {
  const context = useOptionalContext(SelectFloatingContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SelectFloatingContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return context;
}
