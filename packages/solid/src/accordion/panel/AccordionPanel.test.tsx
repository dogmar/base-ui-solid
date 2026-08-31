import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { reset as resetLogs } from '@base-ui/utils/warn';
import { Accordion } from '..';

const PANEL_CONTENT = 'This is panel content';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Accordion.Panel />', () => {
  beforeEach(() => {
    resetLogs();
  });

  it('warns when a panel enables hiddenUntilFound and disables keepMounted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(() => (
        <Accordion.Root>
          <Accordion.Item>
            <Accordion.Panel hiddenUntilFound keepMounted={false}>
              {PANEL_CONTENT}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion.Root>
      ));
      await settle();

      expect(warnSpy).toHaveBeenCalledWith(
        'Base UI: The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
      );
      expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('passes root keepMounted to closed panels', async () => {
    render(() => (
      <Accordion.Root keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('hidden');
  });

  it('passes root hiddenUntilFound to closed panels and allows panel overrides', async () => {
    render(() => (
      <Accordion.Root hiddenUntilFound keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 1</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value={1}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 2</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound={false} keepMounted={false}>
            Overridden panel
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    expect(screen.queryByText('Overridden panel')).toBe(null);
  });
});
