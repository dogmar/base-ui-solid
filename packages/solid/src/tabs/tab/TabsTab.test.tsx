import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Tabs } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Tabs.Tab />', () => {
  describe('prop: nativeButton', () => {
    it('renders as an anchor and toggles selection when `nativeButton` is false', async () => {
      render(() => (
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab nativeButton={false} render={<a href="#overview" />} value="overview">
              Overview
            </Tabs.Tab>
            <Tabs.Tab nativeButton={false} render={<a href="#details" />} value="details">
              Details
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0].tagName).toBe('A');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      await userEvent.click(tabs[1]);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('throws a descriptive error when rendered outside <Tabs.List>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <Tabs.Root>
            <Tabs.Tab value="1" />
          </Tabs.Root>
        )),
      ).toThrow(
        'Base UI: TabsListContext is missing. TabsList parts must be placed within <Tabs.List>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('pointer interaction', () => {
    function TwoTabs(props: {
      onValueChange?: Tabs.Root.Props['onValueChange'];
      disabledSecond?: boolean;
    }) {
      return (
        <Tabs.Root defaultValue={0} onValueChange={props.onValueChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0}>One</Tabs.Tab>
            <Tabs.Tab value={1} disabled={props.disabledSecond}>
              Two
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      );
    }

    it('does not re-commit the value when the active tab is pressed', async () => {
      const handleValueChange = vi.fn();
      render(() => <TwoTabs onValueChange={handleValueChange} />);
      await settle();

      const [firstTab] = screen.getAllByRole('tab');
      await userEvent.pointer({ keys: '[MouseLeft]', target: firstTab });
      await settle();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
    });

    it('does not activate a disabled tab that is pressed and focused', async () => {
      const handleValueChange = vi.fn();
      render(() => <TwoTabs onValueChange={handleValueChange} disabledSecond />);
      await settle();

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await userEvent.pointer({ keys: '[MouseLeft]', target: secondTab });
      // Disabled tabs stay focusable, and `activateOnFocus` must not select them.
      secondTab.focus();
      await settle();

      expect(secondTab).toHaveFocus();
      expect(handleValueChange).not.toHaveBeenCalled();
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('does not activate a tab focused by a held secondary-button press', async () => {
      const handleValueChange = vi.fn();
      render(() => <TwoTabs onValueChange={handleValueChange} />);
      await settle();

      const [, secondTab] = screen.getAllByRole('tab');
      await userEvent.pointer({ keys: '[MouseRight>]', target: secondTab });
      secondTab.focus();
      await settle();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });

    it('activates on focus again once a secondary-button press has ended', async () => {
      const handleValueChange = vi.fn();
      render(() => <TwoTabs onValueChange={handleValueChange} />);
      await settle();

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      await userEvent.pointer({ keys: '[MouseRight]', target: secondTab });
      await settle();

      expect(handleValueChange).not.toHaveBeenCalled();

      firstTab.focus();
      await settle();
      await userEvent.keyboard('{ArrowRight}');
      await settle();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });

    it('activates on focus again once a secondary-button press is cancelled', async () => {
      const handleValueChange = vi.fn();
      render(() => <TwoTabs onValueChange={handleValueChange} />);
      await settle();

      const [firstTab, secondTab] = screen.getAllByRole('tab');
      fireEvent.pointerDown(secondTab, { button: 2 });
      fireEvent.pointerCancel(secondTab);
      await settle();

      firstTab.focus();
      await settle();
      await userEvent.keyboard('{ArrowRight}');
      await settle();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard activation', () => {
    (
      [
        ['Enter', '{Enter}'],
        ['Space', ' '],
      ] as const
    ).forEach(([label, key]) => {
      it(`activates the focused tab with ${label} when \`activateOnFocus\` is false`, async () => {
        render(() => (
          <Tabs.Root defaultValue={0}>
            <Tabs.List>
              <Tabs.Tab value={0}>One</Tabs.Tab>
              <Tabs.Tab value={1}>Two</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        ));
        await settle();

        const [firstTab, secondTab] = screen.getAllByRole('tab');
        firstTab.focus();
        await settle();
        await userEvent.keyboard('{ArrowRight}');
        await settle();

        expect(secondTab).toHaveFocus();
        expect(secondTab).toHaveAttribute('aria-selected', 'false');

        await userEvent.keyboard(key);
        await settle();

        expect(secondTab).toHaveAttribute('aria-selected', 'true');
        expect(firstTab).toHaveAttribute('aria-selected', 'false');
      });
    });
  });
});
