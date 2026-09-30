import { expect } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Toolbar } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Toolbar.Link />', () => {
  describe('ARIA attributes', () => {
    it('renders an anchor', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Link data-testid="link" href="https://base-ui.com" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('link')).toBe(screen.getByRole('link'));
    });

    it('exposes the toolbar orientation as a data attribute', async () => {
      render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Link href="https://base-ui.com" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByRole('link')).toHaveAttribute('data-orientation', 'vertical');
    });
  });

  describe('prop: render', () => {
    it('renders via the render prop', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Link render={(props) => <a {...props} data-testid="rendered" href="#" />} />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('rendered')).toBe(screen.getByRole('link'));
    });
  });

  describe('keyboard navigation', () => {
    it('participates in roving focus', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushMicrotasks();
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');
      const link = screen.getByRole('link');

      expect(link).toHaveAttribute('tabindex', '-1');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(link).toHaveFocus();
      expect(link).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(link, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();
    });
  });
});
