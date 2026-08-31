import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Accordion } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe('<Accordion.Trigger />', () => {
  it('renders a button with type="button"', async () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps a non-native trigger tabbable', async () => {
    render(() => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger nativeButton={false} render={(props) => <span {...props} />}>
              Trigger
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger).toHaveAttribute('tabindex', '0');
  });
});
