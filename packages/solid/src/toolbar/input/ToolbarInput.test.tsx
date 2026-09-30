import { expect, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { Orientation } from '../../internals/types';
import {
  ARROW_UP,
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
} from '../../internals/composite/composite';
import { Toolbar } from '..';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Toolbar.Input />', () => {
  describe('ARIA attributes', () => {
    it('renders a textbox', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input data-testid="input" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toBe(screen.getByRole('textbox'));
    });

    it('exposes the toolbar orientation as a data attribute', async () => {
      render(() => (
        <Toolbar.Root orientation="vertical">
          <Toolbar.Input />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('data-orientation', 'vertical');
      expect(input).toHaveAttribute('data-focusable');
    });
  });

  describe('prop: render', () => {
    it('renders via the render prop', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input render={(props) => <input {...props} data-testid="rendered" />} />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(screen.getByTestId('rendered')).toBe(screen.getByRole('textbox'));
    });
  });

  describe('prop: disabled', () => {
    it('applies aria-disabled and data attributes without the disabled attribute', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input disabled />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('disabled');
      expect(input).toHaveAttribute('data-disabled');
      expect(input).toHaveAttribute('aria-disabled', 'true');
    });

    it('prevents click default actions while disabled', async () => {
      const [disabled, setDisabled] = createSignal(true);
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input type="checkbox" disabled={disabled()} />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      const input = screen.getByRole('checkbox');

      await userEvent.click(input);
      await flushMicrotasks();
      expect(input).not.toBeChecked();

      setDisabled(false);
      await flushMicrotasks();

      await userEvent.click(input);
      await flushMicrotasks();
      expect(input).toBeChecked();
    });
  });

  describe('keyboard navigation', () => {
    (
      [
        ['horizontal', ARROW_RIGHT, ARROW_LEFT],
        ['vertical', ARROW_DOWN, ARROW_UP],
      ] as const
    ).forEach((entry) => {
      const [orientation, nextKey, prevKey] = entry;

      it(`orientation: ${orientation}`, async () => {
        render(() => (
          <Toolbar.Root orientation={orientation as Orientation}>
            <Toolbar.Button />
            <Toolbar.Input value="abcd" />
            <Toolbar.Button />
          </Toolbar.Root>
        ));
        await flushMicrotasks();
        await flushMicrotasks();

        const input = screen.getByRole('textbox') as HTMLInputElement;
        const [button1, button2] = screen.getAllByRole('button');

        button1.focus();
        await flushMicrotasks();
        expect(button1).toHaveFocus();

        fireEvent.keyDown(button1, { key: nextKey });
        await flushMicrotasks();
        expect(input).toHaveFocus();

        // Moving focus into the input selects its text.
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(4);

        // With a selection present, arrow keys stay within the input.
        fireEvent.keyDown(input, { key: nextKey });
        await flushMicrotasks();
        expect(input).toHaveFocus();

        // With the caret at the end, the next key moves focus out.
        input.setSelectionRange(input.value.length, input.value.length);
        fireEvent.keyDown(input, { key: nextKey });
        await flushMicrotasks();
        expect(button2).toHaveFocus();

        fireEvent.keyDown(button2, { key: prevKey });
        await flushMicrotasks();
        expect(input).toHaveFocus();

        // With the caret at the start, the previous key moves focus out.
        input.setSelectionRange(0, 0);
        fireEvent.keyDown(input, { key: prevKey });
        await flushMicrotasks();
        expect(button1).toHaveFocus();
      });
    });

    it('respects a caret in the middle of the text', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Input value="abcd" />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushMicrotasks();
      await flushMicrotasks();

      const input = screen.getByRole('textbox') as HTMLInputElement;
      const [, button2] = screen.getAllByRole('button');

      input.focus();
      await flushMicrotasks();
      expect(input).toHaveFocus();

      input.setSelectionRange(2, 2);
      fireEvent.keyDown(input, { key: ARROW_RIGHT });
      await flushMicrotasks();
      expect(input).toHaveFocus();

      fireEvent.keyDown(input, { key: ARROW_LEFT });
      await flushMicrotasks();
      expect(input).toHaveFocus();

      // Shift+Arrow makes a selection and never moves focus.
      input.setSelectionRange(input.value.length, input.value.length);
      fireEvent.keyDown(input, { key: ARROW_RIGHT, shiftKey: true });
      await flushMicrotasks();
      expect(input).toHaveFocus();

      fireEvent.keyDown(input, { key: ARROW_RIGHT });
      await flushMicrotasks();
      expect(button2).toHaveFocus();
    });
  });

  describe('rendering a callback ref', () => {
    it('attaches the ref to the input element', async () => {
      const refSpy = vi.fn();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Input ref={refSpy} data-testid="input" />
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      expect(refSpy).toHaveBeenCalledWith(screen.getByTestId('input'));
    });
  });
});
