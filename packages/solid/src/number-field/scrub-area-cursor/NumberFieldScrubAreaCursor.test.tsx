import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';
import { NumberField } from '../index';
import { platform } from '@base-ui/utils/platform';

const isWebKit = platform.engine.webkit;

async function settle(ms = 25) {
  flush();
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
  flush();
}

function pointerDown(target: Element, pointerType: string) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerType, clientX: 0, clientY: 0 }),
  );
  flush();
}

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  it('has presentation role', () => {
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>
    ));
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  it('throws a descriptive error when rendered outside <NumberField.ScrubArea>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() =>
        render(() => (
          <NumberField.Root>
            <NumberField.ScrubAreaCursor />
          </NumberField.Root>
        )),
      ).toThrow(
        'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      pointerDown(scrubArea, 'mouse');
      await settle();

      expect(screen.queryByTestId('scrub-area-cursor')).not.toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      pointerDown(firstScrubArea, 'mouse');
      await settle();

      expect(screen.queryAllByTestId('scrub-area-cursor')).toHaveLength(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    render(() => (
      <NumberField.Root>
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>
    ));

    const scrubArea = screen.getByTestId('scrub-area');

    pointerDown(scrubArea, 'touch');
    await settle();

    expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      const requestLockStub = vi.fn(() => {
        throw new Error('User denied pointer lock');
      });
      Element.prototype.requestPointerLock =
        requestLockStub as typeof Element.prototype.requestPointerLock;

      render(() => (
        <NumberField.Root>
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      pointerDown(scrubArea, 'mouse');
      await settle();

      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
      expect(requestLockStub).toHaveBeenCalled();
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      render(() => (
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>
      ));

      const scrubArea = screen.getByTestId('scrub-area');

      // Quick press and release (tap)
      pointerDown(scrubArea, 'mouse');
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 0 }));
      flush();
      // Wait longer than the delayed pointer lock resolution
      await settle(50);

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });
});
