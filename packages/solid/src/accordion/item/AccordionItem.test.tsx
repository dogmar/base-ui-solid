import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Accordion } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe('<Accordion.Item />', () => {
  it('throws when rendered outside an Accordion.Root', () => {
    expect(() => render(() => <Accordion.Item />)).toThrow(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  });

  it('renders a div with the item state attributes', async () => {
    render(() => (
      <Accordion.Root defaultValue={[0]}>
        <Accordion.Item data-testid="item" value={0}>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    const item = screen.getByTestId('item');
    expect(item.tagName).toBe('DIV');
    expect(item).toHaveAttribute('data-open');
    expect(item).not.toHaveAttribute('data-disabled');
  });

  it('generates a fallback value when none is provided', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <Accordion.Root onValueChange={onValueChange}>
        <Accordion.Item data-testid="item">
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    screen.getByRole('button').click();
    await settle();

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(typeof onValueChange.mock.calls[0][0][0]).toBe('string');
    expect(screen.getByTestId('item')).toHaveAttribute('data-open');
  });
});
