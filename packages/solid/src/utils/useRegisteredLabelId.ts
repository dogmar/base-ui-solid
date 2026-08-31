import { createRenderEffect, onCleanup, type Accessor } from 'solid-js';
import { useBaseUiId } from '../internals/useBaseUiId';

const UNSET = Symbol('base-ui-unset-label-id');

export function useRegisteredLabelId(
  idProp: Accessor<string | undefined>,
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void,
): Accessor<string | undefined> {
  const id = useBaseUiId(idProp);

  // The registered id can feed back into `idProp` (the label id is mirrored through
  // context), so the effect must be idempotent: re-applies with an unchanged id must
  // not write, or the release-then-register pair oscillates the context signal forever.
  let lastSyncedId: string | undefined | typeof UNSET = UNSET;

  createRenderEffect(
    () => id(),
    (currentId) => {
      if (currentId === lastSyncedId) {
        return;
      }
      lastSyncedId = currentId;
      setLabelId(currentId);
    },
  );

  onCleanup(() => {
    if (lastSyncedId === UNSET) {
      return;
    }
    const current = lastSyncedId;
    lastSyncedId = UNSET;
    setLabelId((existingId) => (existingId === current ? undefined : existingId));
  });

  return id;
}
