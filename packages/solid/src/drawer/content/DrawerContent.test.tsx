import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Drawer } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Drawer.Content />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders with the drawer content attribute', async () => {
    render(() => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content data-testid="content">Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await settle();

    const content = screen.getByTestId('content');
    expect(content).toHaveAttribute('data-drawer-content');
    expect(content).not.toHaveAttribute('data-base-ui-swipe-ignore');
  });
});
