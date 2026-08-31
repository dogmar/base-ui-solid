import { createEffect, createSignal, type Accessor } from 'solid-js';
import { useBaseUiId } from '../useBaseUiId';
import type { RefObject } from '../../solid-utils/refs';

export function useAriaLabelledBy(
  explicitAriaLabelledBy: Accessor<string | undefined>,
  labelId: Accessor<string | undefined>,
  labelSourceRef: RefObject<LabelSource>,
  enableFallback: Accessor<boolean> = () => true,
  labelSourceId?: Accessor<string | undefined>,
): Accessor<string | undefined> {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = createSignal<string | undefined>(
    undefined,
    { ownedWrite: true },
  );

  const generatedLabelId = useBaseUiId(() => {
    const sourceId = labelSourceId?.();
    return sourceId ? `${sourceId}-label` : undefined;
  });
  const ariaLabelledBy = () => explicitAriaLabelledBy() ?? labelId() ?? fallbackAriaLabelledBy();

  // Fallback for <span> controls labelled by wrapping/sibling native <label>.
  // The React version runs after every commit; here the effect re-runs when its
  // reactive inputs change, which covers the prop-driven cases. DOM-only
  // association changes (a plain `<label>` mounting elsewhere) are not observed.
  createEffect(
    () => ({
      explicit: explicitAriaLabelledBy(),
      label: labelId(),
      fallbackEnabled: enableFallback(),
      generated: generatedLabelId(),
    }),
    (current) => {
      const nextAriaLabelledBy =
        current.explicit || current.label || !current.fallbackEnabled
          ? undefined
          : getAriaLabelledBy(labelSourceRef.current, current.generated);

      if (fallbackAriaLabelledBy() !== nextAriaLabelledBy) {
        setFallbackAriaLabelledBy(nextAriaLabelledBy);
      }
    },
  );

  return ariaLabelledBy;
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  // Fast path before the expensive `.labels` read.
  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}

type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };
