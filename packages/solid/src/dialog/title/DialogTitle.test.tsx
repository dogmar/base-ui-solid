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

describe.skipIf(!isJSDOM)('<Dialog.Title />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders an h2 and labels the dialog', async () => {
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title data-testid="title">Title text</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    const title = screen.getByTestId('title');
    expect(title.tagName).toBe('H2');
    expect(screen.getByTestId('popup').getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('supports a custom id', async () => {
    render(() => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup">
            <Dialog.Title id="custom-title-id">Title text</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    expect(screen.getByTestId('popup')).toHaveAttribute('aria-labelledby', 'custom-title-id');
  });
});
