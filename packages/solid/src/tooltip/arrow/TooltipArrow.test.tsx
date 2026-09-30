import { describe, expect, it } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { isJSDOM } from '#test-utils';
import { Tooltip } from '..';

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe.skipIf(!isJSDOM)('<Tooltip.Arrow />', () => {
  function ArrowTooltip(props: { arrowPadding?: number; triggerWidth?: number }) {
    return (
      <div style={{ position: 'fixed', top: '0', left: '0' }}>
        <Tooltip.Root open>
          <Tooltip.Trigger style={{ width: `${props.triggerWidth ?? 20}px`, height: '20px' }}>
            T
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="bottom" arrowPadding={props.arrowPadding}>
              <Tooltip.Popup style={{ width: '200px', height: '40px' }}>
                <Tooltip.Arrow data-testid="arrow" style={{ width: '10px', height: '10px' }} />
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    );
  }

  it('is hidden from assistive technology and mirrors the resolved side', async () => {
    render(() => <ArrowTooltip />);
    await settle();

    const arrow = screen.getByTestId('arrow');

    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-open');
  });
});
