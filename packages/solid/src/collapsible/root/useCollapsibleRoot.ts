import { createSignal, untrack, type Accessor } from 'solid-js';
import { useControlled } from '../../solid-utils/useControlled';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useTransitionStatus, type TransitionStatus } from '../../internals/useTransitionStatus';
import type { CollapsibleRoot } from './CollapsibleRoot';

/**
 * Solid port of `useCollapsibleRoot`. `parameters` should be a reactive object
 * (use getters for reactive values); reactive return values are accessors.
 */
export function useCollapsibleRoot(
  parameters: UseCollapsibleRootParameters,
): UseCollapsibleRootReturnValue {
  const [open, setOpen] = useControlled({
    controlled: () => parameters.open,
    default: untrack(() => parameters.defaultOpen) ?? false,
    name: 'Collapsible',
    state: 'open',
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(() => open(), true, true);

  const defaultPanelId = useBaseUiId();
  // `undefined` uses the initial generated fallback; `null` means the panel unmounted.
  const [registeredPanelId, setPanelIdState] = createSignal<string | null | undefined>(undefined, {
    ownedWrite: true,
  });
  const panelId: Accessor<string | undefined> = () =>
    registeredPanelId() === null ? undefined : (registeredPanelId() ?? defaultPanelId());

  const handleTrigger = (event: MouseEvent | KeyboardEvent) => {
    const nextOpen = !untrack(open);
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    parameters.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  };

  return {
    defaultPanelId,
    disabled: () => parameters.disabled,
    handleTrigger,
    mounted,
    open,
    panelId,
    setMounted,
    setOpen,
    setPanelIdState,
    transitionStatus,
  };
}

export interface UseCollapsibleRootParameters {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface UseCollapsibleRootReturnValue {
  defaultPanelId: Accessor<string | undefined>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: Accessor<boolean>;
  handleTrigger: (event: MouseEvent | KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: Accessor<boolean>;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: Accessor<boolean>;
  panelId: Accessor<string | undefined>;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (open: boolean) => void;
  setPanelIdState: (
    next:
      | string
      | null
      | undefined
      | ((prev: string | null | undefined) => string | null | undefined),
  ) => void;
  transitionStatus: Accessor<TransitionStatus>;
}

export interface UseCollapsibleRootState {}
