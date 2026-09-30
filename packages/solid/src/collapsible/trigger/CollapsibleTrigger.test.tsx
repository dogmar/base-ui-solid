import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Collapsible } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe('<Collapsible.Trigger />', () => {
  it('throws when rendered outside a Collapsible.Root', () => {
    expect(() => render(() => <Collapsible.Trigger />)).toThrow(
      'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
    );
  });

  it('renders a button with type="button"', async () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    await settle();

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('forwards the id prop', async () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger id="custom-trigger-id">Trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    await settle();

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'id',
      'custom-trigger-id',
    );
  });

  it('supports the render prop with a non-native button', async () => {
    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger nativeButton={false} render={(props) => <span {...props} />}>
          Trigger
        </Collapsible.Trigger>
      </Collapsible.Root>
    ));
    await settle();

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    expect(trigger.tagName).toBe('SPAN');
    expect(trigger).toHaveAttribute('tabindex', '0');
  });
});
