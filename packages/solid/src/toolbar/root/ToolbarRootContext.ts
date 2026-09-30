import type { Accessor } from 'solid-js';
import type { Orientation } from '../../internals/types';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface ToolbarRootContext {
  disabled: Accessor<boolean>;
  orientation: Accessor<Orientation>;
}

export const ToolbarRootContext = createOptionalContext<ToolbarRootContext>();

export function useToolbarRootContext(optional?: false): ToolbarRootContext;
export function useToolbarRootContext(optional: true): ToolbarRootContext | undefined;
export function useToolbarRootContext(optional?: boolean) {
  const context = useOptionalContext(ToolbarRootContext);
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  }

  return context;
}
