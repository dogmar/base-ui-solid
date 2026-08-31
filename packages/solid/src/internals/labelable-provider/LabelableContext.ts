import { createContext, useContext, type Accessor } from 'solid-js';
import { NOOP } from '../noop';
import type { HTMLProps } from '../types';

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `htmlFor` (rendered as `for`), either because the association
   * is implicit or because the control takes its name from `aria-labelledby`.
   */
  controlId: Accessor<string | null | undefined>;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label.
   */
  labelId: Accessor<string | undefined>;
  setLabelId: (value: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  /**
   * An array of `id`s of elements that provide an accessible description.
   */
  messageIds: Accessor<string[]>;
  setMessageIds: (value: string[] | ((prev: string[]) => string[])) => void;
  getDescriptionProps: (externalProps: HTMLProps) => HTMLProps;
}

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
 * with an accessible name (label) and description.
 */
export const LabelableContext = createContext<LabelableContext>({
  controlId: () => undefined,
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: () => undefined,
  setLabelId: NOOP,
  messageIds: () => [],
  setMessageIds: NOOP,
  getDescriptionProps: (externalProps: HTMLProps) => externalProps,
});

export function useLabelableContext() {
  return useContext(LabelableContext);
}
