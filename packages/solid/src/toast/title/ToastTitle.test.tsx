/* eslint-disable react/jsx-fragments */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';
import { List, Button } from '../utils/test-utils';

const toast = {
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

describe('<Toast.Title />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('throws a descriptive error when rendered outside <Toast.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => {
        render(() => (
          <Toast.Provider>
            <Toast.Viewport>
              <Toast.Title />
            </Toast.Viewport>
          </Toast.Provider>
        ));
      }).toThrow(
        'Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('adds aria-labelledby to the root element', async () => {
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

    const titleElement = screen.getByTestId('title');
    const titleId = titleElement.id;

    const rootElement = screen.getByTestId('root');
    expect(rootElement).not.toBe(null);
    expect(rootElement.getAttribute('aria-labelledby')).toBe(titleId);
  });

  it('does not render if it has no children', async () => {
    function AddButton() {
      const { add } = Toast.useToastManager();
      return (
        <button type="button" onClick={() => add({ title: undefined })}>
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

    const titleElement = screen.queryByTestId('title');
    expect(titleElement).toBe(null);
  });

  it('renders the title by default', async () => {
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

    const titleElement = screen.getByTestId('title');
    expect(titleElement).not.toBe(null);
    expect(titleElement.textContent).toBe('title');
  });

  it('renders content passed through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }}>
            <Toast.Title render={<div>render prop title</div>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('render prop title')).not.toBe(null);
  });

  it('renders content passed through a render function', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }}>
            <Toast.Title render={(props) => <div {...props}>render fn title</div>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('render fn title')).not.toBe(null);
  });

  it('wires aria-labelledby to a title rendered through the render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }} data-testid="root">
            <Toast.Title render={<div>render prop title</div>} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    const titleElement = screen.getByText('render prop title');
    const rootElement = screen.getByTestId('root');
    expect(rootElement.getAttribute('aria-labelledby')).toBe(titleElement.id);
  });

  it('does not render a childless render prop when there is no content', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }}>
            <Toast.Title render={<div data-testid="title-render" />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.queryByTestId('title-render')).toBe(null);
  });

  it('renders a numeric zero child', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }}>
            <Toast.Title>{0}</Toast.Title>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('0')).not.toBe(null);
  });

  it('does not render when a render function returns no element', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test' }} data-testid="root">
            <Toast.Title data-testid="title-render" render={(() => null) as any} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByTestId('root')).not.toBe(null);
    expect(screen.queryByTestId('title-render')).toBe(null);
  });

  it('clears aria-labelledby from the root when the title content is removed', async () => {
    function Fixture() {
      const [title, setTitle] = createSignal<JSX.Element>('Toast title');
      return (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={{ id: 'test' }} data-testid="root">
              <Toast.Title>{title()}</Toast.Title>
            </Toast.Root>
          </Toast.Viewport>
          <button type="button" onClick={() => setTitle(null)}>
            clear
          </button>
        </Toast.Provider>
      );
    }

    render(() => <Fixture />);
    await settle();

    const rootElement = screen.getByTestId('root');
    expect(rootElement.getAttribute('aria-labelledby')).not.toBe(null);

    await click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.queryByText('Toast title')).toBe(null);
    expect(rootElement.getAttribute('aria-labelledby')).toBe(null);
  });

  it('does not let an older title cleanup clear a newer title', async () => {
    const [titles, setTitles] = createSignal<'old' | 'both' | 'new'>('old');

    function Fixture() {
      return (
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={{ id: 'test' }} data-testid="root">
              <Show when={titles() !== 'new'}>
                <Toast.Title id="old-title">Old</Toast.Title>
              </Show>
              <Show when={titles() !== 'old'}>
                <Toast.Title id="new-title">New</Toast.Title>
              </Show>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>
      );
    }

    render(() => <Fixture />);
    await settle();

    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('aria-labelledby', 'old-title');

    setTitles('both');
    await settle();
    expect(root).toHaveAttribute('aria-labelledby', 'new-title');

    setTitles('new');
    await settle();
    expect(root).toHaveAttribute('aria-labelledby', 'new-title');
  });

  it('renders the toast title through a childless render prop', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Title render={<div />} />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ));
    await settle();

    expect(screen.getByText('Toast title')).not.toBe(null);
  });
});
