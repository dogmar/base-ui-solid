import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';
import type { ToastRoot } from '../root/ToastRoot';
import { List, Button } from '../utils/test-utils';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

async function click(element: Element) {
  fireEvent.click(element);
  await settle();
}

describe('<Toast.Action />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const toast: ToastRoot.ToastObject = {
    id: 'test',
    title: 'title',
  };

  it('performs an action when clicked', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });

    await click(button);

    expect(screen.getByTestId('action').id).toBe('action');
  });

  it('does not render if it has no children', async () => {
    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() =>
            add({
              actionProps: {
                children: undefined,
              },
            })
          }
        >
          add
        </button>
      );
    }

    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    await click(button);

    const actionElement = screen.queryByTestId('action');
    expect(actionElement).toBe(null);
  });

  it('renders content passed through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action render={<button type="button">render prop action</button>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('render prop action')).not.toBe(null);
  });

  it('does not render a childless render prop when there is no action content', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action render={<button type="button" data-testid="action-render" />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.queryByTestId('action-render')).toBe(null);
  });

  it('renders the toast action content through a childless render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', actionProps: { children: 'Undo' } }}>
            <Toast.Action render={<button type="button" />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('Undo')).not.toBe(null);
  });
});
