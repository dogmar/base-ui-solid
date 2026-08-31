import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { ScrollArea } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function mockViewportMetrics(viewport: HTMLDivElement | null) {
  if (!viewport) {
    return;
  }

  const metrics = {
    clientHeight: 100,
    scrollHeight: 1000,
    clientWidth: 100,
    scrollWidth: 1000,
  };

  for (const [key, value] of Object.entries(metrics)) {
    const descriptor = Object.getOwnPropertyDescriptor(viewport, key);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(viewport, key, { value, configurable: true });
    }
  }
}

describe('<ScrollArea.Corner />', () => {
  it('is hidden from the accessibility tree by default', async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport ref={mockViewportMetrics} style={{ width: '100px', height: '100px' }}>
          <div style={{ width: '1000px', height: '1000px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" keepMounted style={{ width: '10px' }} />
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted style={{ height: '10px' }} />
        <ScrollArea.Corner data-testid="corner" />
      </ScrollArea.Root>
    ));
    await settle();

    expect(screen.getByTestId('corner')).toHaveAttribute('aria-hidden', 'true');
  });

  it('allows overriding aria-hidden', async () => {
    render(() => (
      <ScrollArea.Root>
        <ScrollArea.Viewport ref={mockViewportMetrics} style={{ width: '100px', height: '100px' }}>
          <div style={{ width: '1000px', height: '1000px' }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" keepMounted style={{ width: '10px' }} />
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted style={{ height: '10px' }} />
        <ScrollArea.Corner data-testid="corner" aria-hidden={undefined} />
      </ScrollArea.Root>
    ));
    await settle();

    expect(screen.getByTestId('corner')).not.toHaveAttribute('aria-hidden');
  });
});
