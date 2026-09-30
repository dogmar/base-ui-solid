import { createRenderEffect, onCleanup, type Accessor } from 'solid-js';
import { NOOP } from '../noop';
import { useBaseUiId } from '../useBaseUiId';
import { useLabelableContext } from './LabelableContext';

export function useLabelableId(
  params: UseLabelableIdParameters = {},
): Accessor<UseLabelableIdReturnValue> {
  const id = () => params.id;
  const enabled = () => params.enabled ?? true;

  const context = useLabelableContext();
  const registerControlId = context.registerControlId;
  const resetControlId = context.resetControlId;

  // Deliberately not seeded with `id`: a seed would stick around after the
  // `id` prop is removed, leaving the control on a stale id forever.
  const defaultId = useBaseUiId();

  const controlSource = Symbol();
  let hasRegistered = false;
  let hadExplicitId = false;

  const unregisterControlId = () => {
    if (!hasRegistered || registerControlId === NOOP) {
      return;
    }

    hasRegistered = false;
    registerControlId(controlSource, undefined);
  };

  createRenderEffect(
    () => ({ id: id(), enabled: enabled(), defaultId: defaultId() }),
    (current) => {
      if (!current.enabled || registerControlId === NOOP) {
        unregisterControlId();
        return;
      }

      let nextId: string | null | undefined;

      if (current.id !== undefined) {
        hadExplicitId = true;
        nextId = current.id;
      } else if (hadExplicitId) {
        nextId = current.defaultId;
      } else {
        // An id-less replacement must claim the provider's fallback so a previously registered
        // explicit id is not retained after its control unmounts.
        resetControlId();
        return;
      }

      // The control never had an explicit `id` and no fallback id exists yet;
      // not worth registering.
      if (nextId === undefined) {
        unregisterControlId();
        return;
      }

      hasRegistered = true;
      registerControlId(controlSource, nextId);
    },
  );

  // Unregistering during reactive cleanup, matching the React layout-phase timing: a
  // replacement control's registration effect must not still see the outgoing control's
  // registration afterwards.
  onCleanup(unregisterControlId);

  // The provider's id wins until registration runs: the label renders `for` from the
  // provider's pre-registration state, so preempting it with an explicit `id` here would
  // leave the pair unassociated in server-rendered markup.
  return () => (enabled() ? context.controlId() : undefined) ?? id() ?? defaultId()!;
}

export interface UseLabelableIdParameters {
  /**
   * The control's `id`. Pass `null` for a control that takes its name from `aria-labelledby`
   * instead, so that the label omits `htmlFor` (rendered as `for`).
   */
  id?: string | null | undefined;
  /**
   * Whether the control owns the label association of its labelable scope.
   * @default true
   */
  enabled?: boolean | undefined;
}

export type UseLabelableIdReturnValue = string;

export interface UseLabelableIdState {}
