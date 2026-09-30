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

describe.skipIf(!isJSDOM)('<Drawer.Indent />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('sets data-active when any drawer is open', async () => {
    render(() => (
      <Drawer.Provider>
        <Drawer.Indent data-testid="indent">App</Drawer.Indent>
        <Drawer.Root>
          <Drawer.Trigger data-testid="trigger">Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Close data-testid="close">Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </Drawer.Provider>
    ));
    await settle();

    const indent = screen.getByTestId('indent');
    expect(indent).toHaveAttribute('data-inactive');

    fireEvent.click(screen.getByTestId('trigger'));
    await settle();

    expect(indent).toHaveAttribute('data-active');

    fireEvent.click(screen.getByTestId('close'));
    await settle();

    expect(indent).toHaveAttribute('data-inactive');
  });

  it('renders without a provider', async () => {
    render(() => <Drawer.Indent data-testid="indent">App</Drawer.Indent>);
    await settle();

    expect(screen.getByTestId('indent')).toHaveAttribute('data-inactive');
  });
});
