import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toast } from '..';
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

describe('<Toast.Close />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('closes the toast when clicked', async () => {
    render(() => (
      <Toast.Provider>
        <Toast.Viewport data-testid="viewport">
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>
    ));
    await settle();

    const button = screen.getByRole('button', { name: 'add' });
    const viewport = screen.getByTestId('viewport');

    await click(button);

    expect(screen.getByTestId('title')).not.toBe(null);

    viewport.focus();
    await settle();

    const closeButton = screen.getByRole('button', { name: 'close-press' });

    await click(closeButton);

    expect(screen.queryByTestId('title')).toBe(null);
  });
});
