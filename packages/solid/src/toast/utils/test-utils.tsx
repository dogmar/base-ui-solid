import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Toast } from '..';

/**
 * @internal
 */
export function Button(): JSX.Element {
  const { add } = Toast.useToastManager();
  return (
    <button
      type="button"
      onClick={() => {
        add({
          title: 'title',
          description: 'description',
          actionProps: {
            id: 'action',
            children: 'action',
          },
        });
      }}
    >
      add
    </button>
  );
}

/**
 * @internal
 */
export function List(): JSX.Element {
  const manager = Toast.useToastManager();
  return (
    <For each={manager.toasts} keyed={(toastItem) => toastItem.id}>
      {(toastItem) => (
        <Toast.Root toast={toastItem()} data-testid="root">
          <Toast.Title data-testid="title" />
          <Toast.Description data-testid="description" />
          <Toast.Close aria-label="close-press" />
          <Toast.Action data-testid="action" />
        </Toast.Root>
      )}
    </For>
  );
}
