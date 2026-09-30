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

describe('<Toolbar.Group />', () => {
  describe('ARIA attributes', () => {
    it('renders a group', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('group')).toBe(screen.getByRole('group'));
    });

    it('exposes the toolbar orientation as a data attribute', async () => {
      render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Group />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
    });
  });

  describe('prop: render', () => {
    it('renders via the render prop', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group render={(props) => <div {...props} data-testid="rendered" />} />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('rendered')).toBe(screen.getByRole('group'));
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links in the group', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input value="" />
          </Toolbar.Group>
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');

      [screen.getByRole('button'), screen.getByRole('textbox')].forEach((toolbarItem) => {
        expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
        expect(toolbarItem).toHaveAttribute('data-disabled');
      });

      expect(screen.getByText('Link')).not.toHaveAttribute('data-disabled');
      expect(screen.getByText('Link')).not.toHaveAttribute('aria-disabled');
    });
  });
});
