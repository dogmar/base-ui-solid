import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Toolbar.Button />', () => {
  describe('ARIA attributes', () => {
    it('renders a button', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('button')).toBe(screen.getByRole('button'));
    });

    it('exposes the toolbar orientation as a data attribute', async () => {
      render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-orientation', 'vertical');
      expect(button).toHaveAttribute('data-focusable');
    });
  });

  describe('prop: render', () => {
    it('renders via the render prop and stays activatable', async () => {
      const handleClick = vi.fn();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            nativeButton={false}
            onClick={handleClick}
            render={(props) => <span {...props} data-testid="rendered" />}
          >
            Save
          </Toolbar.Button>
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const button = screen.getByRole('button', { name: 'Save' });
      expect(button).toBe(screen.getByTestId('rendered'));
      expect(button.tagName).toBe('SPAN');

      button.focus();
      await flushMicrotasks();
      expect(button).toHaveFocus();

      // Space activates composite items on keydown by dispatching a real click.
      fireEvent.keyDown(button, { key: ' ' });
      await flushMicrotasks();
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(button, { key: 'Enter' });
      await flushMicrotasks();
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('prop: disabled', () => {
    it('disables the button', async () => {
      const handleClick = vi.fn();
      const handleMouseDown = vi.fn().mockName('handleMouseDown');
      const handlePointerDown = vi.fn();
      const handleKeyDown = vi.fn();

      render(() => (
        <Toolbar.Root>
          <Toolbar.Button
            disabled
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onPointerDown={handlePointerDown}
            onKeyDown={handleKeyDown}
          />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const button = screen.getByRole('button');

      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');

      await userEvent.click(button);
      await flushMicrotasks();
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyDown(button, { key: 'Enter' });
      await flushMicrotasks();

      expect(handleClick).toHaveBeenCalledTimes(0);
      expect(handleMouseDown).toHaveBeenCalledTimes(0);
      expect(handlePointerDown).toHaveBeenCalledTimes(0);
      expect(handleKeyDown).toHaveBeenCalledTimes(0);
    });

    it('uses the disabled attribute when focusableWhenDisabled is false', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).not.toHaveAttribute('aria-disabled');
    });

    it('is disabled by a disabled Toolbar.Group', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
          </Toolbar.Group>
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('disabled');
      expect(button).toHaveAttribute('data-disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
