import { createSignal, flush, Show } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { reset as resetLogs } from '@base-ui/utils/warn';
import { Accordion } from '..';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT_1 = 'Panel contents 1';
const PANEL_CONTENT_2 = 'Panel contents 2';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Accordion.Root />', () => {
  beforeEach(() => {
    resetLogs();
  });

  it('warns when hiddenUntilFound overrides keepMounted={false}', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <Accordion.Root hiddenUntilFound keepMounted={false}>
          <Accordion.Item>
            <Accordion.Panel>Panel</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.',
      );
      expect(screen.getByText('Panel').getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('ARIA attributes', () => {
    it('renders correct ARIA attributes', async () => {
      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');
      const panel = screen.queryByText(PANEL_CONTENT_1) as HTMLElement;

      expect(trigger).toHaveAttribute('aria-controls');
      expect(panel.getAttribute('id')).toBe(trigger.getAttribute('aria-controls'));
      expect(panel).toHaveAttribute('role', 'region');
      expect(trigger.getAttribute('id')).toBe(panel.getAttribute('aria-labelledby'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel id="custom-panel-id">{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');
      const panel = screen.queryByText(PANEL_CONTENT_1) as HTMLElement;

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });

    it('references manual trigger id in panel aria-labelledby', async () => {
      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger id="custom-trigger-id">Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id');
    });

    it('updates panel labeling when a manual trigger id is added or changed', async () => {
      const [triggerId, setTriggerId] = createSignal<string | undefined>(undefined);

      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger id={triggerId()}>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Trigger 1' });
      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(trigger).toHaveAttribute('id');
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);

      setTriggerId('custom-trigger-id-1');
      await settle();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('id', 'custom-trigger-id-1');
      });
      await waitFor(() => {
        expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id-1');
      });

      setTriggerId('custom-trigger-id-2');
      await settle();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('id', 'custom-trigger-id-2');
      });
      await waitFor(() => {
        expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id-2');
      });
    });

    it('restores panel labeling when a manual trigger id is removed', async () => {
      const [triggerId, setTriggerId] = createSignal<string | undefined>('custom-trigger-id');

      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger id={triggerId()}>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button', { name: 'Trigger 1' });
      const panel = screen.getByText(PANEL_CONTENT_1);

      expect(panel).toHaveAttribute('aria-labelledby', 'custom-trigger-id');

      setTriggerId(undefined);
      await settle();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('id');
      });
      expect(trigger).not.toHaveAttribute('id', 'custom-trigger-id');
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
    });

    it('unregisters generated part ids when the trigger or panel unmounts', async () => {
      const [parts, setParts] = createSignal<'both' | 'trigger' | 'panel'>('both');

      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Show when={parts() !== 'panel'}>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Show>
            </Accordion.Header>
            <Show when={parts() !== 'trigger'}>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Show>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      setParts('panel');
      await settle();
      expect(screen.getByText(PANEL_CONTENT_1)).not.toHaveAttribute('aria-labelledby');

      setParts('both');
      await settle();
      let trigger = screen.getByRole('button', { name: 'Trigger 1' });
      let panel = screen.getByText(PANEL_CONTENT_1);
      expect(panel).toHaveAttribute('aria-labelledby', trigger.id);

      setParts('trigger');
      await settle();
      expect(screen.getByRole('button', { name: 'Trigger 1' })).not.toHaveAttribute(
        'aria-controls',
      );

      setParts('both');
      await settle();
      trigger = screen.getByRole('button', { name: 'Trigger 1' });
      panel = screen.getByText(PANEL_CONTENT_1);
      expect(trigger).toHaveAttribute('aria-controls', panel.id);
    });
  });

  describe('uncontrolled', () => {
    it('open state', async () => {
      render(() => (
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

      await userEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      });
    });

    describe('prop: defaultValue', () => {
      it('custom item value', async () => {
        render(() => (
          <Accordion.Root defaultValue={['first']}>
            <Accordion.Item value="first">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="second">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        ));
        await settle();

        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
        expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

        expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      });
    });
  });

  describe('controlled', () => {
    it('open state', async () => {
      const [value, setValue] = createSignal<number[]>([]);

      render(() => (
        <Accordion.Root value={value()}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);

      setValue([0]);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

      setValue([]);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      });
    });

    describe('prop: value', () => {
      it('custom item value', async () => {
        render(() => (
          <Accordion.Root value={['one']}>
            <Accordion.Item value="one">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="second">
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        ));
        await settle();

        expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
        expect(screen.queryByText(PANEL_CONTENT_1)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');

        expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      });
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole accordion', async () => {
      render(() => (
        <Accordion.Root defaultValue={[0]} disabled>
          <Accordion.Item data-testid="item1" value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item data-testid="item2" value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const item1 = screen.getByTestId('item1');
      const panel1 = screen.queryByText(PANEL_CONTENT_1);
      const [header1, header2] = screen.getAllByRole('heading');
      const [trigger1, trigger2] = screen.getAllByRole('button');
      const item2 = screen.getByTestId('item2');

      [item1, header1, trigger1, panel1, item2, header2, trigger2].forEach((element) => {
        expect(element).toHaveAttribute('data-disabled');
      });
    });

    it('can disable one accordion item', async () => {
      render(() => (
        <Accordion.Root defaultValue={[0]}>
          <Accordion.Item data-testid="item1" value={0} disabled>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item data-testid="item2" value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const item1 = screen.getByTestId('item1');
      const panel1 = screen.queryByText(PANEL_CONTENT_1);
      const [header1, header2] = screen.getAllByRole('heading');
      const [trigger1, trigger2] = screen.getAllByRole('button');
      const item2 = screen.getByTestId('item2');

      [item1, header1, trigger1, panel1].forEach((element) => {
        expect(element).toHaveAttribute('data-disabled');
      });
      [item2, header2, trigger2].forEach((element) => {
        expect(element).not.toHaveAttribute('data-disabled');
      });
    });

    it.each(['root', 'item'] as const)(
      'does not toggle or fire callbacks when the %s is disabled',
      async (disabledPart) => {
        const onValueChange = vi.fn();
        const onOpenChange = vi.fn();

        render(() => (
          <Accordion.Root disabled={disabledPart === 'root'} onValueChange={onValueChange}>
            <Accordion.Item
              value={0}
              disabled={disabledPart === 'item'}
              onOpenChange={onOpenChange}
            >
              <Accordion.Header>
                <Accordion.Trigger disabled={false}>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value={1} onOpenChange={onOpenChange}>
              <Accordion.Header>
                <Accordion.Trigger disabled={false}>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        ));
        await settle();

        const [trigger1] = screen.getAllByRole('button');

        await userEvent.click(trigger1);
        await settle();
        trigger1.focus();
        await userEvent.keyboard('[Space]');
        await userEvent.keyboard('[Enter]');
        await settle();

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
        expect(onValueChange.mock.calls.length).toBe(0);
        expect(onOpenChange.mock.calls.length).toBe(0);
      },
    );
  });

  it('allows onMouseUp to call preventBaseUIHandler on the trigger', async () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger onMouseUp={(event) => event.preventBaseUIHandler()}>
              Trigger 1
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    const trigger = screen.getByRole('button', { name: 'Trigger 1' });

    expect(() => fireEvent.mouseUp(trigger)).not.toThrow();
  });

  describe('BaseUIChangeEventDetails', () => {
    it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Accordion.Root onValueChange={onValueChange}>
          <Accordion.Item
            value={0}
            onOpenChange={(nextOpen, eventDetails) => {
              if (nextOpen) {
                eventDetails.cancel();
              }
            }}
          >
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(0);
    });

    it('onValueChange cancel() prevents opening while uncontrolled', async () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: any) => {
        eventDetails.cancel();
      });

      render(() => (
        <Accordion.Root onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('onValueChange cancel() prevents closing while uncontrolled', async () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: any) => {
        eventDetails.cancel();
      });

      render(() => (
        <Accordion.Root defaultValue={[0]} onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(onValueChange).toHaveBeenCalledOnce();
      expect(onValueChange.mock.lastCall?.[0]).toEqual([]);
    });

    it('onOpenChange cancel() prevents onValueChange while controlled', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Accordion.Root value={[]} onValueChange={onValueChange}>
          <Accordion.Item
            value={0}
            onOpenChange={(nextOpen, eventDetails) => {
              if (nextOpen) {
                eventDetails.cancel();
              }
            }}
          >
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(0);
    });

    it('onValueChange cancel() prevents opening while multiple', async () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: any) => {
        eventDetails.cancel();
      });

      render(() => (
        <Accordion.Root multiple onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });

    it('onValueChange cancel() prevents closing while multiple', async () => {
      const onValueChange = vi.fn((_value: unknown, eventDetails: any) => {
        eventDetails.cancel();
      });

      render(() => (
        <Accordion.Root defaultValue={[0]} multiple onValueChange={onValueChange}>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const trigger = screen.getByRole('button');

      fireEvent.click(trigger);
      await settle();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT_1)).not.toBe(null);
      expect(onValueChange.mock.calls.length).toBe(1);
    });
  });

  describe('prop: multiple', () => {
    it('multiple items can be open when `multiple = true`', async () => {
      render(() => (
        <Accordion.Root multiple>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).not.toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);

      await userEvent.click(trigger1);
      await settle();
      await userEvent.click(trigger2);
      await settle();

      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(screen.queryByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger1).toHaveAttribute('data-panel-open');
      expect(trigger2).toHaveAttribute('data-panel-open');

      await userEvent.click(trigger1);
      await settle();

      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      });
      expect(screen.getByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).toHaveAttribute('data-panel-open');
    });

    it('when false only one item can be open', async () => {
      render(() => (
        <Accordion.Root multiple={false}>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_1}</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{PANEL_CONTENT_2}</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT_2)).toBe(null);
      expect(trigger1).not.toHaveAttribute('data-panel-open');
      expect(trigger2).not.toHaveAttribute('data-panel-open');

      await userEvent.click(trigger1);
      await settle();

      expect(screen.queryByText(PANEL_CONTENT_1)).toHaveAttribute('data-open');
      expect(trigger1).toHaveAttribute('data-panel-open');

      await userEvent.click(trigger2);
      await settle();

      expect(screen.queryByText(PANEL_CONTENT_2)).toHaveAttribute('data-open');
      expect(trigger2).toHaveAttribute('data-panel-open');
      await waitFor(() => {
        expect(screen.queryByText(PANEL_CONTENT_1)).toBe(null);
      });
      expect(trigger1).not.toHaveAttribute('data-panel-open');
    });
  });

  describe('prop: onValueChange', () => {
    it('default item value', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Accordion.Root onValueChange={onValueChange} multiple>
          <Accordion.Item value={0}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value={1}>
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await userEvent.click(trigger1);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([0]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
      expect(onValueChange.mock.lastCall?.[1].event.type).not.toBe('base-ui');

      await userEvent.click(trigger2);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toEqual([0, 1]);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
      expect(onValueChange.mock.lastCall?.[1].event.type).not.toBe('base-ui');
    });

    it('custom item value', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Accordion.Root onValueChange={onValueChange} multiple>
          <Accordion.Item value="one">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="two">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await userEvent.click(trigger2);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['two']);

      await userEvent.click(trigger1);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two', 'one']);
    });

    it('`multiple` is false', async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Accordion.Root onValueChange={onValueChange} multiple={false}>
          <Accordion.Item value="one">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>1</Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="two">
            <Accordion.Header>
              <Accordion.Trigger>Trigger 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>2</Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      const [trigger1, trigger2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await userEvent.click(trigger1);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      await userEvent.click(trigger2);
      await settle();

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });
  });
});
