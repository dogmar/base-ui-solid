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

describe.skipIf(!isJSDOM)('<Drawer.Provider />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('stays active until every open drawer is closed', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent">App</Drawer.Indent>
        <Drawer.Root disablePointerDismissal>
          <Drawer.Trigger data-testid="trigger-1">Open 1</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Close data-testid="close-1">Close 1</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
        <Drawer.Root disablePointerDismissal>
          <Drawer.Trigger data-testid="trigger-2">Open 2</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Close data-testid="close-2">Close 2</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));
    await settle();

    const indent = screen.getByTestId('indent');
    expect(indent).toHaveAttribute('data-inactive');

    fireEvent.click(screen.getByTestId('trigger-1'));
    await settle();
    fireEvent.click(screen.getByTestId('trigger-2'));
    await settle();

    expect(indent).toHaveAttribute('data-active');

    fireEvent.click(screen.getByTestId('close-1'));
    await settle();

    expect(indent).toHaveAttribute('data-active');

    fireEvent.click(screen.getByTestId('close-2'));
    await settle();

    expect(indent).toHaveAttribute('data-inactive');
  });
});
