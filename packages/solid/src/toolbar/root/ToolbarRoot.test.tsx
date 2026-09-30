import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider, type TextDirection } from '../../direction-provider';
import type { Orientation } from '../../internals/types';
import { Toggle } from '../../toggle';
import { ToggleGroup } from '../../toggle-group';
import { Toolbar } from '..';
import { useToolbarRootContext } from './ToolbarRootContext';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

// Item metadata cascades through the composite list before `disabledIndices`
// settles, so tests that assert on the initial tab stop flush twice.
async function flushEffects() {
  await flushMicrotasks();
  await flushMicrotasks();
}

describe('<Toolbar.Root />', () => {
  describe('ARIA attributes', () => {
    it('has role="toolbar"', async () => {
      const { container } = render(() => <Toolbar.Root />);
      await flushMicrotasks();

      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'toolbar');
    });

    it('has aria-orientation matching the orientation prop', async () => {
      const { container } = render(() => <Toolbar.Root orientation="vertical" />);
      await flushMicrotasks();

      const toolbar = container.firstElementChild as HTMLElement;
      expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
      expect(toolbar).toHaveAttribute('data-orientation', 'vertical');
    });

    it('defaults to horizontal orientation', async () => {
      const { container } = render(() => <Toolbar.Root />);
      await flushMicrotasks();

      const toolbar = container.firstElementChild as HTMLElement;
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
      expect(toolbar).toHaveAttribute('data-orientation', 'horizontal');
    });
  });

  describe('prop: render', () => {
    it('renders via the render prop with merged props and state attributes', async () => {
      render(() => (
        <Toolbar.Root
          disabled
          render={(props, state) => (
            <div data-testid="custom" data-state-disabled={state.disabled ? 'yes' : 'no'} {...props} />
          )}
        />
      ));
      await flushMicrotasks();

      const toolbar = screen.getByTestId('custom');
      expect(toolbar).toHaveAttribute('role', 'toolbar');
      expect(toolbar).toHaveAttribute('data-disabled');
      expect(toolbar).toHaveAttribute('data-state-disabled', 'yes');
    });
  });

  describe('context', () => {
    function OptionalToolbarConsumer() {
      const context = useToolbarRootContext(true);
      return <span>{context?.orientation() ?? 'outside'}</span>;
    }

    it('allows optional consumers both outside and inside a toolbar', async () => {
      render(() => (
        <div>
          <OptionalToolbarConsumer />
          <Toolbar.Root orientation="vertical">
            <OptionalToolbarConsumer />
          </Toolbar.Root>
        </div>
      ));
      await flushMicrotasks();

      expect(screen.getByText('outside')).toBeVisible();
      expect(screen.getByText('vertical')).toBeVisible();
    });
  });

  describe('keyboard navigation', () => {
    (
      [
        ['ltr', 'horizontal', 'ArrowRight', 'ArrowLeft'],
        ['ltr', 'vertical', 'ArrowDown', 'ArrowUp'],
        ['rtl', 'horizontal', 'ArrowLeft', 'ArrowRight'],
        ['rtl', 'vertical', 'ArrowDown', 'ArrowUp'],
      ] as const
    ).forEach((entry) => {
      const [direction, orientation, nextKey, prevKey] = entry;

      describe(direction, () => {
        it(`orientation: ${orientation}`, async () => {
          render(() => (
            <div dir={direction}>
              <DirectionProvider direction={direction as TextDirection}>
                <Toolbar.Root orientation={orientation as Orientation}>
                  <Toolbar.Button />
                  <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
                  <Toolbar.Group>
                    <Toolbar.Button />
                    <Toolbar.Button />
                  </Toolbar.Group>
                  <Toolbar.Input value="" />
                </Toolbar.Root>
              </DirectionProvider>
            </div>
          ));
          await flushEffects();

          const [button1, groupedButton1, groupedButton2] = screen.getAllByRole('button');
          const link = screen.getByText('Link');
          const input = screen.getByRole('textbox');

          button1.focus();
          await flushMicrotasks();
          expect(button1).toHaveFocus();

          fireEvent.keyDown(button1, { key: nextKey });
          await flushMicrotasks();
          expect(link).toHaveFocus();

          fireEvent.keyDown(link, { key: nextKey });
          await flushMicrotasks();
          expect(groupedButton1).toHaveFocus();

          fireEvent.keyDown(groupedButton1, { key: nextKey });
          await flushMicrotasks();
          expect(groupedButton2).toHaveFocus();

          fireEvent.keyDown(groupedButton2, { key: nextKey });
          await flushMicrotasks();
          expect(input).toHaveFocus();

          // loop to the beginning
          fireEvent.keyDown(input, { key: nextKey });
          await flushMicrotasks();
          expect(button1).toHaveFocus();

          fireEvent.keyDown(button1, { key: prevKey });
          await flushMicrotasks();
          expect(input).toHaveFocus();

          fireEvent.keyDown(input, { key: prevKey });
          await flushMicrotasks();
          expect(groupedButton2).toHaveFocus();
        });
      });
    });

    it('does not wrap focus when loopFocus is false', async () => {
      render(() => (
        <Toolbar.Root loopFocus={false}>
          <Toolbar.Button data-testid="first" />
          <Toolbar.Button data-testid="last" />
        </Toolbar.Root>
      ));
      await flushEffects();

      const first = screen.getByTestId('first');
      const last = screen.getByTestId('last');

      first.focus();
      await flushMicrotasks();
      expect(first).toHaveFocus();

      fireEvent.keyDown(first, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expect(first).toHaveFocus();

      fireEvent.keyDown(first, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(last).toHaveFocus();

      fireEvent.keyDown(last, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(last).toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links', async () => {
      render(() => (
        <Toolbar.Root disabled>
          <Toolbar.Button />
          <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
          <Toolbar.Input value="" />
          <Toolbar.Group>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input value="" />
          </Toolbar.Group>
        </Toolbar.Root>
      ));
      await flushMicrotasks();

      [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')].forEach(
        (toolbarItem) => {
          expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
          expect(toolbarItem).toHaveAttribute('data-disabled');
        },
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');

      screen.getAllByText('Link').forEach((link) => {
        expect(link).not.toHaveAttribute('data-disabled');
        expect(link).not.toHaveAttribute('aria-disabled');
      });
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    function expectFocusedWhenDisabled(element: Element) {
      expect(element).toHaveAttribute('data-disabled');
      expect(element).toHaveAttribute('aria-disabled', 'true');
      expect(element).toHaveFocus();
    }

    it('toolbar items can be focused when disabled by default', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled />
          </Toolbar.Group>
          <Toolbar.Input value="" disabled />
        </Toolbar.Root>
      ));
      await flushEffects();

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      [input, ...buttons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(groupedButton1);

      fireEvent.keyDown(groupedButton1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(groupedButton2);

      fireEvent.keyDown(groupedButton2, { key: 'ArrowRight' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button1).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(button1, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(input);

      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(groupedButton2);
    });

    it('toolbar items can individually disable focusableWhenDisabled', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled focusableWhenDisabled={false} />
          </Toolbar.Group>
          <Toolbar.Input value="" disabled />
        </Toolbar.Root>
      ));
      await flushEffects();

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      const focusableWhenDisabledButtons = buttons.filter(
        (button) => button.getAttribute('data-focusable') != null,
      );
      [input, ...focusableWhenDisabledButtons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;
      expect(groupedButton2).toHaveAttribute('disabled');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(groupedButton1);

      fireEvent.keyDown(groupedButton1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button1).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(button1, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(input);

      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expectFocusedWhenDisabled(groupedButton1);
    });

    it('moves the initial tab stop off a disabled, non-focusable first item', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushEffects();

      const [button1, button2, button3] = screen.getAllByRole('button');
      // a natively disabled first item cannot hold the single roving tab stop
      expect(button1).toHaveAttribute('disabled');
      expect(button1).not.toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '0');

      button2.focus();
      await flushMicrotasks();
      expect(button2).toHaveFocus();

      fireEvent.keyDown(button2, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button3).toHaveFocus();

      // looping back skips the disabled first item
      fireEvent.keyDown(button3, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();
    });

    it('keeps an enabled item with focusableWhenDisabled={false} navigable', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Button focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushEffects();

      const [button1, button2, button3] = screen.getAllByRole('button');
      expect(button2).not.toHaveAttribute('disabled');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();

      fireEvent.keyDown(button2, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button3).toHaveFocus();
    });

    it('skips a disabled Toolbar.Input with focusableWhenDisabled={false}', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Input value="" disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>
      ));
      await flushEffects();

      const [button1, button2] = screen.getAllByRole('button');
      const input = screen.getByRole('textbox');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(input).not.toHaveFocus();
      expect(button2).toHaveFocus();
    });
  });

  describe('ToggleGroup integration', () => {
    it('renders a plain role="group" element inside a toolbar (no nested composite)', async () => {
      render(() => (
        <Toolbar.Root>
          <ToggleGroup data-testid="toggle-group">
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await flushEffects();

      const group = screen.getByTestId('toggle-group');
      expect(group).toHaveAttribute('role', 'group');
      // The group does not manage its own roving focus inside a toolbar.
      expect(group).not.toHaveAttribute('tabindex');
    });

    it('keeps a single roving tab stop across toolbar items and toggles', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="button" />
          <ToggleGroup defaultValue={['one']} onValueChange={onValueChange}>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await flushEffects();

      const button = screen.getByTestId('button');
      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const three = screen.getByTestId('three');

      expect(one).toHaveAttribute('aria-pressed', 'true');

      // Only one item in the whole toolbar holds the tab stop.
      expect(button).toHaveAttribute('tabindex', '0');
      [one, two, three].forEach((toggle) => {
        expect(toggle).toHaveAttribute('tabindex', '-1');
      });

      button.focus();
      await flushMicrotasks();
      expect(button).toHaveFocus();

      // toggles past the first must be reachable
      fireEvent.keyDown(button, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(one).toHaveFocus();

      fireEvent.keyDown(one, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(two).toHaveFocus();

      fireEvent.keyDown(two, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(three).toHaveFocus();

      fireEvent.keyDown(three, { key: ' ' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      // exclusive selection replaces the previous value
      expect(onValueChange.mock.calls[0][0]).toEqual(['three']);
      expect(one).toHaveAttribute('aria-pressed', 'false');
      expect(three).toHaveAttribute('aria-pressed', 'true');
    });

    it('skips disabled direct ToggleGroup > Toggle children', async () => {
      render(() => (
        <Toolbar.Root>
          <ToggleGroup>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" disabled />
            <Toggle value="three" data-testid="three" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await flushEffects();

      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const three = screen.getByTestId('three');

      expect(two).toBeDisabled();

      one.focus();
      await flushMicrotasks();
      expect(one).toHaveFocus();

      fireEvent.keyDown(one, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(three).toHaveFocus();
      expect(two).not.toHaveAttribute('tabindex', '0');
    });

    it('supports multiple selection for direct ToggleGroup > Toggle children', async () => {
      const onValueChange = vi.fn();
      render(() => (
        <Toolbar.Root>
          <ToggleGroup multiple defaultValue={['one']} onValueChange={onValueChange}>
            <Toggle value="one" data-testid="one" />
            <Toggle value="two" data-testid="two" />
          </ToggleGroup>
        </Toolbar.Root>
      ));
      await flushEffects();

      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');

      await userEvent.click(two);
      await flushMicrotasks();

      expect(onValueChange.mock.calls[0][0]).toEqual(['one', 'two']);
      expect(one).toHaveAttribute('aria-pressed', 'true');
      expect(two).toHaveAttribute('aria-pressed', 'true');
    });

    it('disables direct ToggleGroup children when Toolbar.Group is disabled', async () => {
      render(() => (
        <Toolbar.Root>
          <Toolbar.Button data-testid="before" />
          <Toolbar.Group disabled>
            <ToggleGroup>
              <Toggle value="one" data-testid="one" />
              <Toggle value="two" data-testid="two" />
            </ToggleGroup>
          </Toolbar.Group>
          <Toolbar.Button data-testid="after" />
        </Toolbar.Root>
      ));
      await flushEffects();

      const before = screen.getByTestId('before');
      const one = screen.getByTestId('one');
      const two = screen.getByTestId('two');
      const after = screen.getByTestId('after');

      [one, two].forEach((toggle) => {
        expect(toggle).toBeDisabled();
        expect(toggle).toHaveAttribute('data-disabled');
      });

      before.focus();
      await flushMicrotasks();
      expect(before).toHaveFocus();

      fireEvent.keyDown(before, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(after).toHaveFocus();
      expect(one).not.toHaveAttribute('tabindex', '0');
      expect(two).not.toHaveAttribute('tabindex', '0');
    });
  });
});
