import {
  createContext,
  createRenderEffect,
  createSignal,
  onCleanup,
  untrack,
  useContext,
  type Accessor,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Timeout, useTimeout } from '../../solid-utils/timers';

import { getDelay } from '../hooks/useHoverShared';
import type { FloatingRootContext, Delay, FloatingContext } from '../types';
import {
  type BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * Mutable `{ current }` container, mirroring `React.RefObject` (whose `current`
 * is non-nullable here).
 */
interface MutableRef<T> {
  current: T;
}

interface ContextValue {
  hasProvider: boolean;
  timeoutMs: number;
  delayRef: MutableRef<Delay>;
  initialDelayRef: MutableRef<Delay>;
  timeout: Timeout;
  currentIdRef: MutableRef<string | null | undefined>;
  currentContextRef: MutableRef<{
    onOpenChange: (open: boolean, eventDetails: BaseUIChangeEventDetails<any>) => void;
    setIsInstantPhase: (value: boolean) => void;
  } | null>;
}

const FloatingDelayGroupContext = createContext<ContextValue>({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: { current: 0 },
  initialDelayRef: { current: 0 },
  timeout: new Timeout(),
  currentIdRef: { current: null },
  currentContextRef: { current: null },
});

function resetDelayRef(delayRef: MutableRef<Delay>, initialDelayRef: MutableRef<Delay>) {
  delayRef.current = initialDelayRef.current;
}

export interface FloatingDelayGroupProps {
  children?: JSX.Element | undefined;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Experimental next version of `FloatingDelayGroup` to become the default
 * in the future. This component is not yet stable.
 * Provides context for a group of floating elements that should share a
 * `delay`. Unlike `FloatingDelayGroup`, `useDelayGroup` with this
 * component does not cause a re-render of unrelated consumers of the
 * context when the delay changes.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(props: FloatingDelayGroupProps): JSX.Element {
  const delayRef: MutableRef<Delay> = { current: untrack(() => props.delay) };
  const initialDelayRef: MutableRef<Delay> = { current: untrack(() => props.delay) };
  const currentIdRef: MutableRef<string | null | undefined> = { current: null };
  const currentContextRef: ContextValue['currentContextRef'] = { current: null };
  const timeout = useTimeout();

  createRenderEffect(
    () => props.delay,
    (delay) => {
      initialDelayRef.current = delay;

      if (!currentIdRef.current) {
        delayRef.current = delay;
        return;
      }

      delayRef.current = {
        open: getDelay(delayRef.current, 'open'),
        close: getDelay(delay, 'close'),
      };
    },
  );

  // Solid components run once, so the context value is constructed a single
  // time; the React re-render concern behind this rule does not apply.
  // eslint-disable-next-line react/jsx-no-constructed-context-values
  const contextValue: ContextValue = {
    hasProvider: true,
    get timeoutMs() {
      return props.timeoutMs ?? 0;
    },
    delayRef,
    initialDelayRef,
    currentIdRef,
    currentContextRef,
    timeout,
  };

  return (
    <FloatingDelayGroupContext value={contextValue}>{props.children}</FloatingDelayGroupContext>
  );
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger this hook is used in has opened the tooltip.
   */
  open: boolean;
}

interface UseDelayGroupReturn {
  /**
   * The id of the floating element keeping the delay group active.
   */
  activeIdRef: MutableRef<string | null | undefined>;
  /**
   * The delay reference object.
   */
  delayRef: MutableRef<Delay>;
  /**
   * Whether animations should be removed.
   * Solid port note: an accessor rather than a plain boolean.
   */
  isInstantPhase: Accessor<boolean>;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup`.
 *
 * Solid port notes: `options` should be a reactive object (use a getter for
 * `open`); `isInstantPhase` is returned as an accessor.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(
  context: FloatingRootContext | FloatingContext,
  options: UseDelayGroupOptions = { open: false },
): UseDelayGroupReturn {
  const open = () => options.open;

  const store = 'rootStore' in context ? context.rootStore : context;
  const floatingId = store.useState('floatingId');

  const groupContext = useContext(FloatingDelayGroupContext);
  const { currentIdRef, delayRef, initialDelayRef, currentContextRef, hasProvider, timeout } =
    groupContext;

  const [isInstantPhase, setIsInstantPhase] = createSignal(false, { ownedWrite: true });
  let openRef = untrack(open);

  createRenderEffect(
    () => open(),
    (value) => {
      openRef = value;
    },
  );

  // Guards against Solid 2.0's render effects re-running their apply phase
  // with an unchanged computed value (see PORTING.md rule 20a): the React
  // effects below only ran (and their cleanups only fired) when
  // `open`/`floatingId` actually changed, so cleanups are tracked manually
  // and released from `onCleanup` rather than returned per-apply.
  let lastUnsetApplied: { open: boolean; id: string | undefined } | undefined;
  let lastRegisterApplied: { open: boolean; id: string | undefined } | undefined;

  let unsetEffectCleanup: (() => void) | undefined;
  const runUnsetEffectCleanup = () => {
    const cleanup = unsetEffectCleanup;
    unsetEffectCleanup = undefined;
    cleanup?.();
  };
  void onCleanup(runUnsetEffectCleanup);

  createRenderEffect(
    () => ({ open: open(), id: floatingId() }),
    (current) => {
      if (
        lastUnsetApplied &&
        lastUnsetApplied.open === current.open &&
        lastUnsetApplied.id === current.id
      ) {
        return;
      }
      lastUnsetApplied = current;
      runUnsetEffectCleanup();

      const { open: isOpen, id } = current;

      function unset() {
        currentContextRef.current?.setIsInstantPhase(false);
        currentIdRef.current = null;
        currentContextRef.current = null;
        delayRef.current = initialDelayRef.current;
        timeout.clear();
      }

      if (!currentIdRef.current) {
        return;
      }

      if (!isOpen && currentIdRef.current === id) {
        setIsInstantPhase(false);

        const timeoutMs = groupContext.timeoutMs;
        if (timeoutMs) {
          const closingId = id;
          timeout.start(timeoutMs, () => {
            // If another tooltip has taken over the group, skip resetting.
            if (
              store.select('open') ||
              (currentIdRef.current && currentIdRef.current !== closingId)
            ) {
              return;
            }
            unset();
          });
          unsetEffectCleanup = () => {
            if (openRef || currentIdRef.current !== closingId) {
              timeout.clear();
            }
          };
          return;
        }

        unset();
      }
    },
  );

  createRenderEffect(
    () => ({ open: open(), id: floatingId() }),
    (current) => {
      if (
        lastRegisterApplied &&
        lastRegisterApplied.open === current.open &&
        lastRegisterApplied.id === current.id
      ) {
        return;
      }
      lastRegisterApplied = current;

      const { open: isOpen, id } = current;

      if (!isOpen) {
        return;
      }

      const prevContext = currentContextRef.current;
      const prevId = currentIdRef.current;

      // A new tooltip is opening, so cancel any pending timeout that would reset
      // the group's delay back to the initial value.
      timeout.clear();
      currentContextRef.current = { onOpenChange: store.setOpen, setIsInstantPhase };
      currentIdRef.current = id;
      delayRef.current = {
        open: 0,
        close: getDelay(initialDelayRef.current, 'close'),
      };

      if (prevId !== null && prevId !== id) {
        setIsInstantPhase(true);
        prevContext?.setIsInstantPhase(true);
        prevContext?.onOpenChange(false, createChangeEventDetails(REASONS.none));
      } else {
        setIsInstantPhase(false);
        prevContext?.setIsInstantPhase(false);
      }
    },
  );

  // Mirrors the React unmount effect keyed by `floatingId`: its cleanup runs
  // when the id actually changes and on disposal (manual tracking per rule 20a).
  let lastTrackedId: string | undefined;
  let hasTrackedId = false;
  const runIdCleanup = () => {
    if (!hasTrackedId) {
      return;
    }
    const id = lastTrackedId;
    hasTrackedId = false;
    if (currentIdRef.current === id) {
      currentContextRef.current = null;

      if (!openRef) {
        return;
      }

      currentIdRef.current = null;
      resetDelayRef(delayRef, initialDelayRef);
      timeout.clear();
    }
  };
  void onCleanup(runIdCleanup);

  createRenderEffect(
    () => floatingId(),
    (id) => {
      if (hasTrackedId && lastTrackedId === id) {
        return;
      }
      runIdCleanup();
      lastTrackedId = id;
      hasTrackedId = true;
    },
  );

  return {
    activeIdRef: currentIdRef,
    hasProvider,
    delayRef,
    isInstantPhase,
  };
}
