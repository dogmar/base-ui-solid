import { expect } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Toolbar } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Toolbar.Separator />', () => {
  (
    [
      ['horizontal', 'vertical'],
      ['vertical', 'horizontal'],
    ] as const
  ).forEach(([separatorOrientation, toolbarOrientation]) => {
    it(`uses a ${separatorOrientation} separator in a ${toolbarOrientation} toolbar`, async () => {
      render(() => (
        <Toolbar.Root orientation={toolbarOrientation}>
          <Toolbar.Separator />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-orientation', separatorOrientation);
      expect(separator).toHaveAttribute('data-orientation', separatorOrientation);
    });
  });

  it('allows its orientation to be overridden', async () => {
    render(() => (
      <Toolbar.Root orientation="horizontal">
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>
    ));
    await flushMicrotasks();

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('throws a descriptive error when rendered outside Toolbar.Root', () => {
    expect(() => render(() => <Toolbar.Separator />)).toThrow(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  });
});
