import { expect, vi } from 'vitest';
import { createSignal, flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { reset as resetLogOnce } from '@base-ui/utils/error';
import { DirectionProvider, type TextDirection } from '../direction-provider';
import type { Orientation } from '../internals/types';
import { Toggle } from '../toggle';
import { ToggleGroup } from '.';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<ToggleGroup />', () => {
  it('renders a `group`', async () => {
    render(() => <ToggleGroup aria-label="My Toggle Group" />);
    await flushMicrotasks();

    expect(screen.queryByRole('group', { name: 'My Toggle Group' })).not.toBe(null);
  });

  describe('uncontrolled', () => {
    it('pressed state', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button1);
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button2);
      await flushMicrotasks();

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: defaultValue', async () => {
      render(() => (
        <ToggleGroup defaultValue={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button1);
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });

    it('when Toggles omit value', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle />
          <Toggle value="" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button1);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button2);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('should warn if Toggle value is not set and ToggleGroup value is defined', async () => {
      resetLogOnce();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        render(() => (
          <ToggleGroup defaultValue={['one']}>
            <Toggle />
            <Toggle />
          </ToggleGroup>
        ));
        await flushMicrotasks();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0]).toBe(
          'Base UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
        );
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe('controlled', () => {
    it('pressed state', async () => {
      const [value, setValue] = createSignal<readonly string[]>(['two']);

      render(() => (
        <ToggleGroup value={value()}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');

      setValue(['one']);
      flush();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      setValue(['two']);
      flush();

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not change the pressed state without a parent update', async () => {
      render(() => (
        <ToggleGroup value={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      await userEvent.click(button1);
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole group', async () => {
      render(() => (
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'true');
      expect(button1).toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });

    it('can disable individual items', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'false');
      expect(button1).not.toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: orientation', () => {
    it('vertical', async () => {
      render(() => (
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const group = screen.queryByRole('group');
      expect(group).toHaveAttribute('data-orientation', 'vertical');
    });

    it('does not render aria-orientation on role="group"', async () => {
      render(() => (
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const group = screen.queryByRole('group');
      expect(group).not.toHaveAttribute('aria-orientation');
    });
  });

  describe('prop: multiple', () => {
    it('sets data-multiple only when true', async () => {
      const [multiple, setMultiple] = createSignal<boolean | undefined>(undefined);

      render(() => (
        <ToggleGroup multiple={multiple()}>
          <Toggle value="one" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const group = screen.getByRole('group');
      expect(group).not.toHaveAttribute('data-multiple');

      setMultiple(true);
      flush();
      expect(group).toHaveAttribute('data-multiple');

      setMultiple(false);
      flush();
      expect(group).not.toHaveAttribute('data-multiple');
    });

    it('multiple items can be pressed when true', async () => {
      render(() => (
        <ToggleGroup multiple defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button2);
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('only one item can be pressed when false', async () => {
      render(() => (
        <ToggleGroup defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button2);
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('when Toggles omit value', async () => {
      render(() => (
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button1);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await userEvent.click(button2);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(button1);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('preserves selection and roving focus across `multiple` transitions', async () => {
      const [multiple, setMultiple] = createSignal(false);

      render(() => (
        <ToggleGroup data-testid="toggle-group" defaultValue={['one']} multiple={multiple()}>
          <Toggle value="one">One</Toggle>
          <Toggle value="two">Two</Toggle>
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const group = screen.getByTestId('toggle-group');
      const [button1, button2] = screen.getAllByRole('button');

      expect(group).not.toHaveAttribute('data-multiple');
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      button1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();

      await userEvent.click(button2);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      setMultiple(true);
      flush();
      expect(group).toHaveAttribute('data-multiple');

      await userEvent.click(button1);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(button2);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      setMultiple(false);
      flush();
      expect(group).not.toHaveAttribute('data-multiple');

      await userEvent.click(button2);
      await flushMicrotasks();
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      fireEvent.keyDown(button2, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expect(button1).toHaveFocus();
    });
  });

  describe('keyboard interactions', () => {
    (
      [
        ['ltr', 'horizontal', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'],
        ['ltr', 'vertical', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'],
        ['rtl', 'horizontal', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'],
        ['rtl', 'vertical', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'],
      ] as const
    ).forEach((entry) => {
      const [direction, orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey] = entry;

      describe(direction, () => {
        it(`orientation: ${orientation}`, async () => {
          render(() => (
            <div dir={direction}>
              <DirectionProvider direction={direction as TextDirection}>
                <ToggleGroup orientation={orientation as Orientation}>
                  <Toggle value="one" />
                  <Toggle value="two" />
                  <Toggle value="three" />
                </ToggleGroup>
              </DirectionProvider>
            </div>
          ));
          await flushMicrotasks();

          const [button1, button2, button3] = screen.getAllByRole('button');

          button1.focus();
          await flushMicrotasks();

          expect(button1).toHaveAttribute('tabindex', '0');
          expect(button1).toHaveFocus();

          fireEvent.keyDown(button1, { key: nextKey });
          await flushMicrotasks();

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          fireEvent.keyDown(button2, { key: nextKey });
          await flushMicrotasks();

          expect(button3).toHaveAttribute('tabindex', '0');
          expect(button3).toHaveFocus();

          // loop to the beginning
          fireEvent.keyDown(button3, { key: nextKey });
          await flushMicrotasks();

          expect(button1).toHaveAttribute('tabindex', '0');
          expect(button1).toHaveFocus();

          fireEvent.keyDown(button1, { key: prevKey });
          await flushMicrotasks();

          expect(button3).toHaveAttribute('tabindex', '0');
          expect(button3).toHaveFocus();

          fireEvent.keyDown(button3, { key: prevKey });
          await flushMicrotasks();

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          // keys from the other axis should not move focus
          fireEvent.keyDown(button2, { key: ignoredNextKey });
          await flushMicrotasks();

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          fireEvent.keyDown(button2, { key: ignoredPrevKey });
          await flushMicrotasks();

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();
        });
      });
    });

    it('does not loop when loopFocus is disabled', async () => {
      render(() => (
        <ToggleGroup loopFocus={false}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      button2.focus();
      await flushMicrotasks();

      fireEvent.keyDown(button2, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(button2).toHaveAttribute('tabindex', '0');
      expect(button2).toHaveFocus();
      expect(button1).toHaveAttribute('tabindex', '-1');
    });

    it('Home key moves focus to the first item', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2, button3] = screen.getAllByRole('button');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      fireEvent.keyDown(button2, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button3).toHaveFocus();

      fireEvent.keyDown(button3, { key: 'Home' });
      await flushMicrotasks();
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();

      fireEvent.keyDown(button2, { key: 'Home' });
      await flushMicrotasks();
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();
    });

    it('End key moves focus to the last item', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2, button3] = screen.getAllByRole('button');

      button1.focus();
      await flushMicrotasks();
      expect(button1).toHaveFocus();

      fireEvent.keyDown(button1, { key: 'End' });
      await flushMicrotasks();
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();

      fireEvent.keyDown(button3, { key: 'ArrowLeft' });
      await flushMicrotasks();
      expect(button2).toHaveFocus();

      fireEvent.keyDown(button2, { key: 'End' });
      await flushMicrotasks();
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();
    });

    it('key: Space toggles the pressed state', async () => {
      render(() => (
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');

      button1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(button1, { key: ' ' });
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'true');

      fireEvent.keyDown(button1, { key: ' ' });
      await flushMicrotasks();

      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: onValueChange', () => {
    it('fires when an Item is clicked', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(onValueChange).toHaveBeenCalledTimes(0);

      await userEvent.click(button1);
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      await userEvent.click(button2);
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });

    it('does not change the value when the event is canceled', async () => {
      const onValueChange = vi.fn((_value: string[], eventDetails: ToggleGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1] = screen.getAllByRole('button');

      await userEvent.click(button1);
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('fires when Space is pressed', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2] = screen.getAllByRole('button');

      expect(onValueChange).toHaveBeenCalledTimes(0);

      button1.focus();
      await flushMicrotasks();
      fireEvent.keyDown(button1, { key: ' ' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      button2.focus();
      await flushMicrotasks();
      fireEvent.keyDown(button2, { key: ' ' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });
  });

  describe('Toggle integration', () => {
    it('a Toggle inside a ToggleGroup participates in roving focus and group value', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>
      ));
      await flushMicrotasks();

      const [button1, button2, button3] = screen.getAllByRole('button');

      // Only the highlighted item is in the tab sequence.
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '-1');
      expect(button3).toHaveAttribute('tabindex', '-1');

      button1.focus();
      await flushMicrotasks();

      fireEvent.keyDown(button1, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(button2).toHaveFocus();
      expect(button2).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveAttribute('tabindex', '-1');

      // Activating the focused item commits it into the group value.
      fireEvent.keyDown(button2, { key: ' ' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['two']);
      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');

      // Roving focus continues from the pressed item.
      fireEvent.keyDown(button2, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(button3).toHaveFocus();
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '-1');

      // Pressing another toggle in single mode unpresses the previous one.
      fireEvent.keyDown(button3, { key: ' ' });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['three']);
      expect(button3).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
