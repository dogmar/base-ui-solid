import { expect, vi } from 'vitest';
import { flush, omit } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Slider } from '../index';
import { getHorizontalSliderRect } from '../utils/test-utils';

// The React suite additionally covers touch interactions and drags that rely
// on real thumb measurements in Chromium-only tests (`it.skipIf(isJSDOM)`);
// jsdom cannot measure layout, so those are intentionally not ported.

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Slider.Control />', () => {
  it('does not apply a tabIndex by default', async () => {
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    expect(screen.getByTestId('control')).not.toHaveAttribute('tabindex');
  });

  it('throws a descriptive error when rendered outside <Slider.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Slider.Control />)).toThrow(
        'Base UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('moves the first of several thumbs stacked at the maximum', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root defaultValue={[100, 100, 100]} onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb-0" />
          <Slider.Thumb index={1} data-testid="thumb-1" />
          <Slider.Thumb index={2} data-testid="thumb-2" />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const control = screen.getByTestId('control');
    const lastThumb = screen.getByTestId('thumb-2');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(lastThumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(90, 0, 20, 10));

    fireEvent.pointerDown(lastThumb, { buttons: 1, clientX: 100 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 50 });
    flush();

    expect(onValueChange).toHaveBeenLastCalledWith(
      [50, 100, 100],
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  it('clears the grabbed offset when swapping to a thumb that is not rendered', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root
        defaultValue={[20, 40]}
        thumbCollisionBehavior="swap"
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    fireEvent.pointerDown(thumb, { buttons: 1, clientX: 30 });
    flush();
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 70 });
    flush();
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });
    flush();

    expect(onValueChange).toHaveBeenLastCalledWith(
      [40, 80],
      expect.objectContaining({ activeThumbIndex: 1, reason: 'drag' }),
    );
  });

  it('ignores a drag when collision behavior cannot satisfy the minimum distance', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root
        value={[20, 40]}
        thumbCollisionBehavior="none"
        minStepsBetweenValues={50}
        onValueChange={onValueChange}
      >
        <Slider.Control data-testid="control">
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 0, 20, 10));

    fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 20 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 80 });
    flush();

    expect(onValueChange).not.toHaveBeenCalled();
  });

  [
    {
      name: 'horizontal',
      orientation: 'horizontal' as const,
      controlRect: new DOMRect(0, 0, 100, 10),
      thumbRect: new DOMRect(40, 0, 20, 10),
      pointer: { clientX: 10, clientY: 5 },
    },
    {
      name: 'vertical',
      orientation: 'vertical' as const,
      controlRect: new DOMRect(0, 0, 10, 100),
      thumbRect: new DOMRect(0, 40, 10, 20),
      pointer: { clientX: 5, clientY: 90 },
    },
  ].forEach(({ name, orientation, controlRect, thumbRect, pointer }) => {
    it(`accounts for the thumb size when pressing an inset ${name} control`, async () => {
      const onValueChange = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={50}
          orientation={orientation}
          thumbAlignment="edge-client-only"
          onValueChange={onValueChange}
        >
          <Slider.Control data-testid="control">
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(controlRect);
      vi.spyOn(screen.getByTestId('thumb'), 'getBoundingClientRect').mockReturnValue(thumbRect);

      fireEvent.pointerDown(control, { button: 0, buttons: 1, ...pointer });
      flush();

      expect(onValueChange).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ activeThumbIndex: 0, reason: 'track-press' }),
      );
    });
  });

  it('releases pointer capture when the interaction ends', async () => {
    render(() => (
      <Slider.Root defaultValue={20}>
        <Slider.Control data-testid="control">
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const control = screen.getByTestId('control');
    vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
    const releasePointerCapture = vi.fn();
    Object.defineProperties(control, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: () => true },
      releasePointerCapture: { configurable: true, value: releasePointerCapture },
    });

    fireEvent.pointerDown(control, {
      pointerId: 7,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 40,
    });
    flush();
    fireEvent.pointerUp(document.body, {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 40,
    });
    flush();

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('degrades safely when a custom render function drops the control ref', async () => {
    const onValueChange = vi.fn();
    const { unmount } = render(() => (
      <Slider.Root defaultValue={20} onValueChange={onValueChange}>
        {/* Dropping `ref` from the spread mirrors the React suite's
            `ref={null}` override: the control element ref is never applied. */}
        <Slider.Control
          data-testid="control"
          render={(props) => <div {...omit(props as Record<string, any>, 'ref')} />}
        >
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    fireEvent.pointerDown(screen.getByTestId('control'), {
      button: 0,
      buttons: 1,
      clientX: 80,
    });
    flush();
    expect(onValueChange).not.toHaveBeenCalled();

    unmount();
  });
});
