import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Toast } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Toast.Portal />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  // The React suite only runs `describeConformance` for this part; the Solid
  // port covers the equivalent portal behavior directly.

  it('portals its children into the document body by default', async () => {
    const { container } = render(() => (
      <Toast.Provider>
        <Toast.Portal data-testid="portal">
          <Toast.Viewport data-testid="viewport" />
        </Toast.Portal>
      </Toast.Provider>
    ));
    await settle();

    const portal = screen.getByTestId('portal');
    expect(portal.parentElement).toBe(document.body);
    expect(container.contains(portal)).toBe(false);
    expect(portal.contains(screen.getByTestId('viewport'))).toBe(true);
  });
});
