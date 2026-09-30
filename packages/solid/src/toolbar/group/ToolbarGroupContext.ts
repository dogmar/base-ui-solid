import type { Accessor } from 'solid-js';
import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface ToolbarGroupContext {
  disabled: Accessor<boolean>;
}

export const ToolbarGroupContext = createOptionalContext<ToolbarGroupContext>();

export function useToolbarGroupContext(): ToolbarGroupContext | undefined {
  return useOptionalContext(ToolbarGroupContext);
}
