import { createOptionalContext, useOptionalContext } from '../../solid-utils/optionalContext';

export interface CSPContextValue {
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}

export const CSPContext = createOptionalContext<CSPContextValue>();

const DEFAULT_CSP_CONTEXT_VALUE: CSPContextValue = {
  disableStyleElements: false,
};

export function useCSPContext(): CSPContextValue {
  return useOptionalContext(CSPContext) ?? DEFAULT_CSP_CONTEXT_VALUE;
}
