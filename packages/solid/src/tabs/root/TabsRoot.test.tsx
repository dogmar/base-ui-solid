import { expect, vi } from 'vitest';
import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider, type TextDirection } from '../../direction-provider';
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

describe('<Tabs.Root />', () => {
  describe('prop: children', () => {
    it('should accept a null child', async () => {
      render(() => (
        <Tabs.Root value={0}>
          {null}
          <Tabs.List>
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getAllByRole('tab')).toHaveLength(1);
    });

    it('should support empty children', async () => {
      render(() => <Tabs.Root value={1} />);
      await settle();
    });

    it('puts the selected child in tab order', async () => {
      const [value, setValue] = createSignal(1);

      render(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, 0]);

      setValue(0);
      await settle();

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });

    it('sets the aria-labelledby attribute on tab panels to the corresponding tab id', async () => {
      render(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[1].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[2]).toHaveAttribute('aria-labelledby', tabs[2].id);
      expect(tabPanels[3]).toHaveAttribute('aria-labelledby', tabs[3].id);
    });

    it('sets the aria-controls attribute on tabs to the corresponding tab panel id', async () => {
      render(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[2]).toHaveAttribute('aria-controls', tabPanels[2].id);
      expect(tabs[3]).toHaveAttribute('aria-controls', tabPanels[3].id);
    });

    it('sets aria-controls on the first tab when no value is provided', async () => {
      render(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted />
          <Tabs.Panel value={1} keepMounted />
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[1].id);
    });

    it('syncs aria-controls to the mounted tab panel when keepMounted is false', async () => {
      render(() => (
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0">Tab 0</Tabs.Tab>
            <Tabs.Tab value="tab-1">Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="tab-0">Panel 0</Tabs.Panel>
          <Tabs.Panel value="tab-1">Panel 1</Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      const [firstTabPanel] = screen.getAllByRole('tabpanel');

      expect(tabs[0]).toHaveAttribute('aria-controls', firstTabPanel.id);
      expect(tabs[1]).not.toHaveAttribute('aria-controls');

      await userEvent.click(tabs[1]);
      await settle();

      await waitFor(() => {
        const [secondTabPanel] = screen.getAllByRole('tabpanel');
        expect(secondTabPanel).toHaveTextContent('Panel 1');
      });
      await waitFor(() => {
        expect(tabs[0]).not.toHaveAttribute('aria-controls');
      });
      const [secondTabPanel] = screen.getAllByRole('tabpanel');
      expect(tabs[1]).toHaveAttribute('aria-controls', secondTabPanel.id);
    });
  });

  describe('prop: value', () => {
    it('should pass selected prop to children', async () => {
      render(() => (
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support values of different types', async () => {
      const tabValues = [0, '1', { value: 2 }, () => 3, Symbol('4'), /5/];

      render(() => (
        <Tabs.Root>
          <Tabs.List>
            {tabValues.map((value) => (
              <Tabs.Tab value={value} />
            ))}
          </Tabs.List>
          {tabValues.map((value) => (
            <Tabs.Panel value={value} keepMounted />
          ))}
        </Tabs.Root>
      ));
      await settle();

      const tabElements = screen.getAllByRole('tab');
      const tabPanelElements = screen.getAllByRole('tabpanel', { hidden: true });

      for (let index = 0; index < tabValues.length; index += 1) {
        expect(tabPanelElements[index]).toHaveAttribute('aria-labelledby', tabElements[index].id);

        tabElements[index].click();
        // eslint-disable-next-line no-await-in-loop
        await settle();

        expect(tabPanelElements[index]).not.toHaveAttribute('hidden');
      }
    });
  });

  describe('disabled tabs', () => {
    it('should select the second tab when the first one is disabled', async () => {
      render(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Disabled tab
            </Tabs.Tab>
            <Tabs.Tab value={1}>Enabled tab</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Disabled panel
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Enabled panel
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      const [disabledTab, enabledTab] = screen.getAllByRole('tab');
      const [disabledPanel, enabledPanel] = screen.getAllByRole('tabpanel', { hidden: true });

      expect(disabledTab).toHaveAttribute('aria-selected', 'false');
      expect(enabledTab).toHaveAttribute('aria-selected', 'true');
      expect(disabledPanel).toHaveAttribute('hidden');
      expect(enabledPanel).not.toHaveAttribute('hidden');
      expect(enabledPanel).toHaveTextContent('Enabled panel');
    });

    it('should select the third tab when first two tabs are disabled', async () => {
      render(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={3}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');

      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit defaultValue even if it points to a disabled tab', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit value prop even if it points to a disabled tab', async () => {
      render(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not set tabIndex=0 on disabled tabs when they are programmatically selected', async () => {
      const [value, setValue] = createSignal(1);

      render(() => (
        <Tabs.Root value={value()}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');

      expect(tabs[1]).toHaveAttribute('tabindex', '0');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[2]).toHaveAttribute('tabindex', '-1');

      setValue(0);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('does not select any tab when all tabs are disabled', async () => {
      render(() => (
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} disabled>
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 2
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('prop: onValueChange', () => {
    it('when `activateOnFocus = true` should call onValueChange on pointerdown', async () => {
      const handleChange = vi.fn();
      const handlePointerDown = vi.fn();
      render(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} onPointerDown={handlePointerDown} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      await userEvent.pointer({ keys: '[MouseLeft>]', target: screen.getAllByRole('tab')[1] });
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handlePointerDown.mock.calls.length).toBe(1);
    });

    it('should not call onValueChange when already active', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      fireEvent.click(screen.getAllByRole('tab')[0]);
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('when `activateOnFocus = true` should call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await settle();

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
    });

    it('when `activateOnFocus = false` should not call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root value={1} onValueChange={handleChange}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [firstTab] = screen.getAllByRole('tab');
      firstTab.focus();
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('calls onValueChange when auto-selecting the first tab on mount', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange with the selected value when the implicit default matches a later tab', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the implicit first tab is disabled', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not cancel automatic value changes', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].event).toBeInstanceOf(Event);
      expect(handleChange.mock.calls[0][1].event.type).toBe('base-ui');
      expect(handleChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not move an uncontrolled selection when a user-initiated change is canceled', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          if (eventDetails.reason === 'none') {
            eventDetails.cancel();
          }
        },
      );

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(tabs[1]);
      await settle();

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onValueChange with null when all tabs are initially disabled', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not emit missing when an enabled tab appears after all tabs were disabled', async () => {
      const handleChange = vi.fn();
      const [enableSecond, setEnableSecond] = createSignal(false);

      render(() => (
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled={!enableSecond()}>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      setEnableSecond(true);
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not call onValueChange on initial render when defaultValue is provided', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root defaultValue={1} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not call onValueChange on initial render when defaultValue is null', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root defaultValue={null} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('treats defaultValue={undefined} as an implicit default when the first tab is disabled', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root defaultValue={undefined} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(false);

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      setDisableFirst(true);
      await settle();

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
      });
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('disabled');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when an explicit disabled default becomes disabled again', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(true);

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      setDisableFirst(false);
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      setDisableFirst(true);
      await settle();

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
      });
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('disabled');
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab is removed', async () => {
      const handleChange = vi.fn();
      const [showFirstTab, setShowFirstTab] = createSignal(true);

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
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

      setShowFirstTab(false);
      await settle();

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
      });
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('missing');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Tab 1');
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
    });

    it('calls onValueChange with null when the selected tab is removed and no tabs remain', async () => {
      const handleChange = vi.fn();
      const [showTab, setShowTab] = createSignal(true);

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Show when={showTab()}>
              <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            </Show>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      setShowTab(false);
      await settle();

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
      });
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('missing');

      expect(screen.queryAllByRole('tab').length).toBe(0);
      await waitFor(() => {
        expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
      });
    });

    it('calls onValueChange when an explicit defaultValue points at a tab that is never present', async () => {
      const handleChange = vi.fn();

      render(() => (
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
      });
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('missing');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not emit a second change when the fallback resolves to the current value', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <Tabs.Root onValueChange={handleValueChange}>
          <Tabs.List>
            <Tabs.Tab value="a" disabled>
              Stale duplicate
            </Tabs.Tab>
            <Tabs.Tab value="a">A</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('a');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('initial');
    });

    it('does not call onValueChange when a controlled selected tab becomes disabled', async () => {
      const handleChange = vi.fn();
      const [disableFirst, setDisableFirst] = createSignal(false);

      render(() => (
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled={disableFirst()}>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      setDisableFirst(true);
      await settle();

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('prop: orientation', () => {
    it('does not add aria-orientation by default', async () => {
      render(() => (
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByRole('tablist')).not.toHaveAttribute('aria-orientation');
    });

    it('adds the proper aria-orientation when vertical', async () => {
      render(() => (
        <Tabs.Root value={0} orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={0} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    });
  });

  describe('pointer navigation', () => {
    it('selects the clicked tab', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      await userEvent.click(tabs[1]);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('does not select the clicked disabled tab', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const tabs = screen.getAllByRole('tab');
      await userEvent.click(tabs[1]);
      await settle();

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('keyboard navigation when focus is on a tab', () => {
    (
      [
        ['horizontal', 'ltr', 'ArrowLeft', 'ArrowRight'],
        ['horizontal', 'rtl', 'ArrowRight', 'ArrowLeft'],
        ['vertical', undefined, 'ArrowUp', 'ArrowDown'],
      ] as Array<
        [Tabs.Root.Props['orientation'], TextDirection | undefined, string, string]
      >
    ).forEach(([orientation, direction, previousItemKey, nextItemKey]) => {
      describe(`when focus is on a tab element in a ${orientation} ${direction ?? ''} tablist`, () => {
        function TestTabs(props: {
          activateOnFocus: boolean;
          value: number;
          onValueChange?: (value: any, eventDetails: Tabs.Root.ChangeEventDetails) => void;
          onKeyDown?: (event: KeyboardEvent) => void;
          disabledTabValue?: number;
        }) {
          return (
            <div dir={direction ?? 'ltr'}>
              <DirectionProvider direction={direction ?? 'ltr'}>
                <Tabs.Root
                  onValueChange={props.onValueChange}
                  orientation={orientation}
                  value={props.value}
                >
                  <Tabs.List activateOnFocus={props.activateOnFocus} onKeyDown={props.onKeyDown}>
                    <Tabs.Tab value={0} disabled={props.disabledTabValue === 0} />
                    <Tabs.Tab value={1} disabled={props.disabledTabValue === 1} />
                    <Tabs.Tab value={2} disabled={props.disabledTabValue === 2} />
                  </Tabs.List>
                </Tabs.Root>
              </DirectionProvider>
            </div>
          );
        }

        describe(previousItemKey, () => {
          describe('with `activateOnFocus = false`', () => {
            it('moves focus to the last tab without activating it if focus is on the first tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus={false}
                  value={0}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              firstTab.focus();
              await settle();

              fireEvent.keyDown(firstTab, { key: previousItemKey });
              await settle();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the previous tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus={false}
                  value={1}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, secondTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await settle();

              fireEvent.keyDown(secondTab, { key: previousItemKey });
              await settle();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus={false}
                  value={2}
                  onKeyDown={handleKeyDown}
                  disabledTabValue={1}
                />
              ));
              await settle();

              const [, disabledTab, lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await settle();

              fireEvent.keyDown(lastTab, { key: previousItemKey });
              await settle();

              expect(disabledTab).toHaveFocus();
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          describe('with `activateOnFocus = true`', () => {
            it('moves focus to the last tab while activating it if focus is on the first tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus
                  value={0}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              firstTab.focus();
              await settle();

              fireEvent.keyDown(firstTab, { key: previousItemKey });
              await settle();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(2);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the previous tab while activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus
                  value={1}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, secondTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await settle();

              fireEvent.keyDown(secondTab, { key: previousItemKey });
              await settle();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleChange = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus
                  value={2}
                  onValueChange={handleChange}
                  disabledTabValue={1}
                />
              ));
              await settle();

              const [, disabledTab, lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await settle();

              fireEvent.keyDown(lastTab, { key: previousItemKey });
              await settle();

              expect(disabledTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
            });
          });
        });

        describe(nextItemKey, () => {
          describe('with `activateOnFocus = false`', () => {
            it('moves focus to the first tab without activating it if focus is on the last tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus={false}
                  value={2}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await settle();

              fireEvent.keyDown(lastTab, { key: nextItemKey });
              await settle();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the next tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus={false}
                  value={1}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [, secondTab, lastTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await settle();

              fireEvent.keyDown(secondTab, { key: nextItemKey });
              await settle();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          describe('with `activateOnFocus = true`', () => {
            it('moves focus to the first tab while activating it if focus is on the last tab', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus
                  value={2}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [firstTab, , lastTab] = screen.getAllByRole('tab');
              lastTab.focus();
              await settle();

              fireEvent.keyDown(lastTab, { key: nextItemKey });
              await settle();

              expect(firstTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });

            it('moves focus to the next tab while activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              render(() => (
                <TestTabs
                  activateOnFocus
                  value={1}
                  onValueChange={handleChange}
                  onKeyDown={handleKeyDown}
                />
              ));
              await settle();

              const [, secondTab, lastTab] = screen.getAllByRole('tab');
              secondTab.focus();
              await settle();

              fireEvent.keyDown(secondTab, { key: nextItemKey });
              await settle();

              expect(lastTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(1);
              expect(handleChange.mock.calls[0][0]).toBe(2);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });
        });
      });
    });

    describe('when focus is on a tab regardless of orientation', () => {
      describe('Home', () => {
        it('when `activateOnFocus = false`, moves focus to the first tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          render(() => (
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
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

          fireEvent.keyDown(lastTab, { key: 'Home' });
          await settle();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the first tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          render(() => (
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
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

          fireEvent.keyDown(lastTab, { key: 'Home' });
          await settle();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        [false, true].forEach((activateOnFocusProp) => {
          it(`when \`activateOnFocus = ${activateOnFocusProp}\`, moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            render(() => (
              <Tabs.Root onValueChange={handleChange} value={2}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeyDown={handleKeyDown}>
                  <Tabs.Tab value={0} disabled />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} />
                </Tabs.List>
              </Tabs.Root>
            ));
            await settle();

            const [disabledTab, , lastTab] = screen.getAllByRole('tab');
            lastTab.focus();
            await settle();

            fireEvent.keyDown(lastTab, { key: 'Home' });
            await settle();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });
        });
      });

      describe('End', () => {
        it('when `activateOnFocus = false`, moves focus to the last tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          render(() => (
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
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

          fireEvent.keyDown(firstTab, { key: 'End' });
          await settle();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the last tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          render(() => (
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
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

          fireEvent.keyDown(firstTab, { key: 'End' });
          await settle();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(2);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        [false, true].forEach((activateOnFocusProp) => {
          it(`when \`activateOnFocus = ${activateOnFocusProp}\`, moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            render(() => (
              <Tabs.Root onValueChange={handleChange} value={0}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeyDown={handleKeyDown}>
                  <Tabs.Tab value={0} />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} disabled />
                </Tabs.List>
              </Tabs.Root>
            ));
            await settle();

            const [firstTab, , disabledTab] = screen.getAllByRole('tab');
            firstTab.focus();
            await settle();

            fireEvent.keyDown(firstTab, { key: 'End' });
            await settle();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });
        });
      });
    });

    it('should allow to focus first tab when there are no active tabs', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'))).toEqual([
        '0',
        '-1',
      ]);
    });
  });

  describe('data attributes', () => {
    it('sets data-activation-direction on the root, list, tabs and panels', async () => {
      render(() => (
        <Tabs.Root defaultValue={0} data-testid="root">
          <Tabs.List data-testid="list">
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted data-testid="panel-0" />
          <Tabs.Panel value={1} keepMounted data-testid="panel-1" />
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'none');
      expect(screen.getByTestId('list')).toHaveAttribute('data-activation-direction', 'none');
      screen.getAllByRole('tab').forEach((tab) => {
        expect(tab).toHaveAttribute('data-activation-direction', 'none');
      });
      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-activation-direction', 'none');
    });

    it('sets data-active and data-disabled on tabs', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      ));
      await settle();

      const [activeTab, disabledTab] = screen.getAllByRole('tab');
      expect(activeTab).toHaveAttribute('data-active');
      expect(activeTab).not.toHaveAttribute('data-disabled');
      expect(disabledTab).toHaveAttribute('data-disabled');
      expect(disabledTab).not.toHaveAttribute('data-active');
    });

    it('sets data-hidden on hidden keepMounted panels', async () => {
      render(() => (
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted data-testid="panel-0" />
          <Tabs.Panel value={1} keepMounted data-testid="panel-1" />
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByTestId('panel-0')).not.toHaveAttribute('data-hidden');
      expect(screen.getByTestId('panel-1')).toHaveAttribute('data-hidden');
    });

    it('sets data-orientation on the root, list, tabs and panels', async () => {
      render(() => (
        <Tabs.Root defaultValue={0} orientation="vertical" data-testid="root">
          <Tabs.List data-testid="list">
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted data-testid="panel-0" />
        </Tabs.Root>
      ));
      await settle();

      expect(screen.getByTestId('root')).toHaveAttribute('data-orientation', 'vertical');
      expect(screen.getByTestId('list')).toHaveAttribute('data-orientation', 'vertical');
      expect(screen.getByRole('tab')).toHaveAttribute('data-orientation', 'vertical');
      expect(screen.getByTestId('panel-0')).toHaveAttribute('data-orientation', 'vertical');
    });
  });
});
