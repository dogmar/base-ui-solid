import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Dialog } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Dialog.Description />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders a p and describes the dialog', async () => {
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Description data-testid="description">Description text</Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const description = screen.getByTestId('description');
    expect(description.tagName).toBe('P');
    expect(screen.getByTestId('popup').getAttribute('aria-describedby')).toBe(description.id);
  });
});
