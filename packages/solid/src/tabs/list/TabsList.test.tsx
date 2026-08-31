import { expect } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
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

describe('<Tabs.List />', () => {
  describe('accessibility attributes', () => {
    it('sets the aria-selected attribute on the active tab', async () => {
      render(() => (
        <Tabs.Root defaultValue={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tab1 = screen.getByText('Tab 1');
      const tab2 = screen.getByText('Tab 2');
      const tab3 = screen.getByText('Tab 3');

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'false');

      tab2.click();
      await settle();

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(tab3).toHaveAttribute('aria-selected', 'false');

      tab3.click();
      await settle();

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'true');

      tab1.click();
      await settle();

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(tab3).toHaveAttribute('aria-selected', 'false');
    });

    it('sets role=tablist on the list', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByRole('tablist')).not.toBe(null);
    });
  });

  describe('prop: loopFocus', () => {
    it('does not wrap focus past the first tab when `loopFocus` is false', async () => {
      render(() => (
        <Tabs.Root value={0}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await settle();

      fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });
      await settle();

      expect(firstTab).toHaveFocus();
      expect(lastTab).not.toHaveFocus();
    });

    it('does not wrap focus past the last tab when `loopFocus` is false', async () => {
      render(() => (
        <Tabs.Root value={2}>
          <Tabs.List loopFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      lastTab.focus();
      await settle();

      fireEvent.keyDown(lastTab, { key: 'ArrowRight' });
      await settle();

      expect(lastTab).toHaveFocus();
      expect(firstTab).not.toHaveFocus();
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus to a tab disabled with the `disabled` prop', async () => {
      render(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} disabled />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab, disabledTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await settle();

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await settle();

      expect(disabledTab).toHaveFocus();
    });

    it('skips a natively disabled tab in a single keypress', async () => {
      render(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} render={<button type="button" disabled />} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab, , lastTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await settle();

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await settle();

      expect(lastTab).toHaveFocus();

      fireEvent.keyDown(lastTab, { key: 'ArrowLeft' });
      await settle();

      expect(firstTab).toHaveFocus();
    });
  });

  describe('roving focus after tab removal', () => {
    it('can fall back to a tab that is focusable when disabled', async () => {
      const [showSelectedTab, setShowSelectedTab] = createSignal(true);

      render(() => (
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Show when={showSelectedTab()}>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Show>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      setShowSelectedTab(false);
      await settle();

      expect(screen.getByText('Tab 0')).toHaveAttribute('tabindex', '0');
      expect(screen.getByText('Tab 1')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the tab stop on the selected tab when focus is inside the list', async () => {
      const [showFirstTab, setShowFirstTab] = createSignal(true);

      render(() => (
        <Tabs.Root value={2}>
          <Tabs.List>
            <Show when={showFirstTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const selectedTab = screen.getByText('Tab 2');
      selectedTab.focus();
      await settle();

      setShowFirstTab(false);
      await settle();

      const [unselectedTab] = screen.getAllByRole('tab');

      expect([unselectedTab.tabIndex, selectedTab.tabIndex]).toEqual([-1, 0]);
    });
  });

  it('can be named via `aria-label`', async () => {
    render(() => (
      <Tabs.Root defaultValue={0}>
        <Tabs.List aria-label="string label">
          <Tabs.Tab value={0} />
        </Tabs.List>
      </Tabs.Root>
    ));
    await settle();

    expect(screen.getByRole('tablist')).toHaveAccessibleName('string label');
  });

  it('can be named via `aria-labelledby`', async () => {
    render(() => (
      <>
        <h3 id="label-id">complex name</h3>
        <Tabs.Root defaultValue={0}>
          <Tabs.List aria-labelledby="label-id">
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      </>
    ));
    await settle();

    expect(screen.getByRole('tablist')).toHaveAccessibleName('complex name');
  });
});
