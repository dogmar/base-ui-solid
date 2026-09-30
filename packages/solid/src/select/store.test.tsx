import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { render, screen } from '@solidjs/testing-library';
import { Select } from '.';
import { useSelectRootContext } from './root/SelectRootContext';
import type { SelectStore } from './store';
import { createChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('select store synchronization', () => {
  beforeEach(() => {
    (globalThis as any).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  function StoreProbe(props: { storeRef: { current: SelectStore | null } }): JSX.Element {
    props.storeRef.current = useSelectRootContext();
    return null;
  }

  it('publishes synchronized values in a single store transaction', async () => {
    const storeRef: { current: SelectStore | null } = { current: null };
    const [id, setId] = createSignal('first');
    const [modal, setModal] = createSignal(true);

    render(() => (
      <Select.Root id={id()} modal={modal()}>
        <StoreProbe storeRef={storeRef} />
        <Select.Trigger />
      </Select.Root>
    ));
    await flushMicrotasks();

    const store = storeRef.current!;
    const snapshots: Array<{ id: string | undefined; modal: boolean }> = [];
    const unsubscribe = store.subscribe((state) => {
      snapshots.push({ id: state.id, modal: state.modal });
    });

    try {
      setId('second');
      setModal(false);
      await flushMicrotasks();
    } finally {
      unsubscribe();
    }

    expect(snapshots.some((snapshot) => snapshot.id === 'second' && snapshot.modal)).toBe(false);
    expect(snapshots.some((snapshot) => snapshot.id === 'first' && !snapshot.modal)).toBe(false);
    expect(snapshots).toContainEqual({ id: 'second', modal: false });
  });

  it('provides setOpen to a descendant ref callback on the first render', async () => {
    const handleOpenChange = vi.fn();
    let invoked = false;

    function CommandProbe(): JSX.Element {
      const store = useSelectRootContext();

      return (
        <div
          ref={(element) => {
            if (element && !invoked) {
              invoked = true;
              store.context.setOpen(true, createChangeEventDetails(REASONS.none));
            }
          }}
        />
      );
    }

    render(() => (
      <Select.Root onOpenChange={handleOpenChange}>
        <CommandProbe />
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="alpha">alpha</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    await flushMicrotasks();

    expect(invoked).toBe(true);
    expect(handleOpenChange).toHaveBeenCalled();
    expect(handleOpenChange.mock.calls[0][0]).toBe(true);
  });

  it('makes an updated disabled prop visible to items immediately', async () => {
    const handleValueChange = vi.fn();
    const [disabled, setDisabled] = createSignal(false);

    render(() => (
      <Select.Root defaultOpen disabled={disabled()} onValueChange={handleValueChange}>
        <Select.Trigger />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item data-testid="item" value="alpha">
                alpha
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));
    await flushMicrotasks();

    setDisabled(true);
    flush();

    screen.getByTestId('item').click();
    await flushMicrotasks();

    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
