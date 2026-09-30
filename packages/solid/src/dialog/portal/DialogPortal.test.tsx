import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe.skipIf(!isJSDOM)('<Dialog.Portal />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('throws a descriptive error when a portaled part is rendered without <Dialog.Portal>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(() => (
        <Dialog.Root defaultOpen>
          <Dialog.Popup />
        </Dialog.Root>
      )),
    ).toThrow(/<Dialog.Portal> is missing/);
    spy.mockRestore();
  });

  it('keeps children mounted when keepMounted is true', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Portal keepMounted>
          <Dialog.Popup data-testid="popup" />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    expect(screen.getByTestId('popup')).toBeInTheDocument();
  });

  it('unmounts children when closed by default', async () => {
    render(() => (
      <Dialog.Root>
        <Dialog.Portal>
          <Dialog.Popup data-testid="popup" />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    await settle();

    expect(screen.queryByTestId('popup')).toBeNull();
  });
});
