import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { Accordion } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
}

describe('<Accordion.Header />', () => {
  it('throws when rendered outside an Accordion.Item', () => {
    expect(() => render(() => <Accordion.Header />)).toThrow(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  });

  it('renders an h3 heading', async () => {
    render(() => (
      <Accordion.Root defaultValue={[0]}>
        <Accordion.Item value={0}>
          <Accordion.Header>Header</Accordion.Header>
        </Accordion.Item>
      </Accordion.Root>
    ));
    await settle();

    const header = screen.getByRole('heading', { name: 'Header' });
    expect(header.tagName).toBe('H3');
    expect(header).toHaveAttribute('data-open');
  });
});
