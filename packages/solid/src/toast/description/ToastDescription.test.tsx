import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';
import type { ToastRoot } from '../root/ToastRoot';
import { List, Button } from '../utils/test-utils';

const toast: ToastRoot.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

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

describe('<Toast.Description />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('adds aria-describedby to the root element', async () => {
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

    const descriptionElement = screen.getByTestId('description');
    const descriptionId = descriptionElement.id;

    const rootElement = screen.getByTestId('root');
    expect(rootElement).not.toBe(null);
    expect(rootElement.getAttribute('aria-describedby')).toBe(descriptionId);
  });

  it('does not render if it has no children', async () => {
    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button type="button" onClick={() => add({ description: undefined })}>
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

    const descriptionElement = screen.queryByTestId('description');
    expect(descriptionElement).toBe(null);
  });

  it('renders the description by default', async () => {
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

    const titleElement = screen.getByTestId('description');
    expect(titleElement).not.toBe(null);
    expect(titleElement.textContent).toBe('description');
  });

  it('renders content passed through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Description render={<div>render prop description</div>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('render prop description')).not.toBe(null);
  });

  it('wires aria-describedby to a description rendered through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }} data-testid="root">
            <Toast.Description render={<div>render prop description</div>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    const descriptionElement = screen.getByText('render prop description');
    const rootElement = screen.getByTestId('root');
    expect(rootElement.getAttribute('aria-describedby')).toBe(descriptionElement.id);
  });

  it('renders the toast description through a childless render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', description: 'Toast description' }}>
            <Toast.Description render={<div />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('Toast description')).not.toBe(null);
  });
});
