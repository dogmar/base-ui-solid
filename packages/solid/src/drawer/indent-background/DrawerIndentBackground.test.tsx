import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Drawer.IndentBackground />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('sets data-active when any drawer is open', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.IndentBackground data-testid="background" />
        <Drawer.Indent>App</Drawer.Indent>
        <Drawer.Root>
          <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));
    await settle();

    const background = screen.getByTestId('background');
    expect(background).toHaveAttribute('data-inactive');

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    expect(background).toHaveAttribute('data-active');
  });
});
