import { expect, expect as expectVitest, vi } from 'vitest';
import { Show, createSignal, flush } from 'solid-js';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { DirectionProvider, type TextDirection } from '../../direction-provider';
import { Field } from '../../field';
import { Form } from '../../form';
import { REASONS } from '../../internals/reasons';
import {
  ARROW_RIGHT,
  ARROW_LEFT,
  ARROW_UP,
  ARROW_DOWN,
  HOME,
  END,
} from '../../internals/composite/composite';
import type { Orientation } from '../../internals/types';
import { Slider } from '../index';
import type { SliderRoot } from './SliderRoot';
import { getHorizontalSliderRect } from '../utils/test-utils';

// The React suite also covers pointer dragging, touch interactions, and
// thumb-position layout in Chromium-only tests (`it.skipIf(isJSDOM)`); jsdom
// cannot measure layout, so those suites are intentionally not ported. The
// server-side rendering and pre-hydration suites do not apply to the Solid
// port at all.

const USD_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
};

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

function TestSlider(props: SliderRoot.Props) {
  return (
    <Slider.Root data-testid="root" {...props}>
      <Slider.Value data-testid="value" />
      <Slider.Control data-testid="control">
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function TestRangeSlider(props: SliderRoot.Props) {
  return (
    <Slider.Root data-testid="root" {...props}>
      <Slider.Value data-testid="value" />
      <Slider.Control data-testid="control">
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

describe('<Slider.Root />', () => {
  beforeAll(() => {
    // jsdom implements PointerEvent but not the pointer capture methods on
    // Element, so the slider's capture calls would throw without this.
    // Mirrors the React suite's setup.
    (window as any).PointerEvent = window.MouseEvent;
  });

  it('warns when max is not greater than min', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(() => <TestSlider defaultValue={10} min={10} max={10} />);
      await settle();
      expect(
        warnSpy.mock.calls.some((args) =>
          args.join(' ').includes('Slider `max` must be greater than `min`.'),
        ),
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe('ARIA attributes', () => {
    it('it has the correct aria attributes', async () => {
      render(() => (
        <Slider.Root defaultValue={30} aria-labelledby="labelId" data-testid="root">
          <Slider.Value />
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const slider = screen.getByRole('slider');

      expect(slider.tagName).toBe('INPUT');

      expect(root).toHaveAttribute('aria-labelledby', 'labelId');

      expect(slider).toHaveAttribute('aria-valuenow', '30');
      expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
      expect(slider).toHaveAttribute('aria-labelledby', 'labelId');
      expect(slider).toHaveAttribute('step', '1');
    });

    it('should update aria-valuenow', async () => {
      render(() => <TestSlider defaultValue={50} />);
      await settle();
      const slider = screen.getByRole('slider');

      slider.focus();

      fireEvent.change(slider, { target: { value: '51' } });
      flush();
      expect(slider).toHaveAttribute('aria-valuenow', '51');

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });
      flush();
      expect(slider).toHaveAttribute('aria-valuenow', '52');
    });

    it('should set default aria-valuetext on range slider thumbs', async () => {
      render(() => <TestRangeSlider defaultValue={[44, 50]} />);
      await settle();

      const [thumb1, thumb2] = screen.getAllByTestId('thumb');

      expect(thumb1.querySelector('input')).toHaveAttribute('aria-valuetext', '44 start range');
      expect(thumb2.querySelector('input')).toHaveAttribute('aria-valuetext', '50 end range');
    });
  });

  describe('prop: disabled', () => {
    it('should render data-disabled on all subcomponents', async () => {
      render(() => (
        <Slider.Root defaultValue={30} disabled data-testid="root">
          <Slider.Value data-testid="value" />
          <Slider.Control data-testid="control">
            <Slider.Track data-testid="track">
              <Slider.Indicator data-testid="indicator" />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const value = screen.getByTestId('value');
      const control = screen.getByTestId('control');
      const track = screen.getByTestId('track');
      const indicator = screen.getByTestId('indicator');
      const thumb = screen.getByTestId('thumb');

      [root, value, control, track, indicator, thumb].forEach((subcomponent) => {
        expect(subcomponent).toHaveAttribute('data-disabled', '');
      });
    });

    it('explicitly blurs the focused thumb when disabled', async () => {
      const [disabled, setDisabled] = createSignal(false);
      render(() => <TestSlider defaultValue={30} disabled={disabled()} />);
      await settle();
      const input = screen.getByRole('slider');

      input.focus();
      expect(input).toHaveFocus();
      const blurSpy = vi.spyOn(input, 'blur');

      setDisabled(true);
      await settle();

      expect(blurSpy).toHaveBeenCalled();
    });

    it('does not drag a thumb disabled via the `disabled` prop', async () => {
      const handleValueChange = vi.fn();
      render(() => (
        <Slider.Root defaultValue={[20, 80]} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb index={0} data-testid="thumb-0" />
              <Slider.Thumb index={1} disabled data-testid="thumb-1" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const disabledInput = screen.getByTestId('thumb-1').querySelector('input')!;
      expect(disabledInput).toBeDisabled();

      fireEvent.pointerDown(screen.getByTestId('thumb-1'), { buttons: 1, clientX: 80 });
      fireEvent.pointerMove(document.body, { buttons: 1, clientX: 40 });
      fireEvent.pointerUp(document.body, { buttons: 1, clientX: 40 });
      flush();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(disabledInput).toHaveAttribute('aria-valuenow', '80');
    });

    it('does not change a single disabled thumb when pressing the track', async () => {
      const handleValueChange = vi.fn();
      render(() => (
        <Slider.Root defaultValue={20} onValueChange={handleValueChange}>
          <Slider.Control data-testid="control">
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb disabled />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const control = screen.getByTestId('control');
      vi.spyOn(control, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const input = screen.getByRole('slider');
      expect(input).toBeDisabled();

      fireEvent.pointerDown(control, { buttons: 1, clientX: 80 });
      fireEvent.pointerUp(control, { buttons: 1, clientX: 80 });
      flush();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(input).toHaveAttribute('aria-valuenow', '20');
    });
  });

  describe('prop: orientation', () => {
    it('sets the `aria-orientation` attribute', async () => {
      render(() => <TestSlider orientation="vertical" />);
      await settle();

      const sliderRoot = screen.getByRole('slider');
      expect(sliderRoot).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('sets the data-orientation attribute', async () => {
      render(() => <TestSlider />);
      await settle();

      const sliderRoot = screen.getByRole('group');
      expect(sliderRoot).toHaveAttribute('data-orientation', 'horizontal');
      const sliderControl = screen.getByTestId('control');
      expect(sliderControl).toHaveAttribute('data-orientation', 'horizontal');
      const sliderOutput = screen.getByTestId('value');
      expect(sliderOutput).toHaveAttribute('data-orientation', 'horizontal');
    });
  });

  describe('prop: step', () => {
    it('supports non-integer values', async () => {
      render(() => (
        <>
          <TestSlider value={51.1} min={-100} max={100} step={0.00000001} />
          <TestSlider value={0.00000005} min={-100} max={100} step={0.00000001} />
          <TestSlider value={1e-7} min={-100} max={100} step={0.00000001} />
        </>
      ));
      await settle();
      const [slider1, slider2, slider3] = screen.getAllByRole('slider');

      expect(slider1).toHaveAttribute('aria-valuenow', '51.1');
      expect(slider2).toHaveAttribute('aria-valuenow', '5e-8');
      expect(slider3).toHaveAttribute('aria-valuenow', '1e-7');
    });
  });

  describe('prop: max', () => {
    it('sets the max attribute on the input', async () => {
      render(() => <TestSlider defaultValue={150} step={100} max={750} />);
      await settle();
      expect(screen.getByRole('slider')).toHaveAttribute('max', '750');
    });

    it('should not go more than the max', async () => {
      render(() => <TestSlider defaultValue={100} step={100} max={200} />);
      await settle();

      const slider = screen.getByRole('slider');

      await userEvent.keyboard('[Tab]');

      await userEvent.keyboard(`[${ARROW_RIGHT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '200');
      await userEvent.keyboard(`[${ARROW_RIGHT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '200');
    });
  });

  describe('prop: min', () => {
    it('sets the min attribute on the input', async () => {
      render(() => <TestSlider defaultValue={150} step={100} min={150} max={200} />);
      await settle();
      expect(screen.getByRole('slider')).toHaveAttribute('min', '150');
    });

    it('should use min as the step origin', async () => {
      render(() => <TestSlider defaultValue={150} step={100} max={750} min={150} />);
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();

      expect(slider).toHaveAttribute('aria-valuenow', '150');
    });

    it('should not go less than the min', async () => {
      render(() => <TestSlider defaultValue={1} step={1} min={0} />);
      await settle();
      const slider = screen.getByRole('slider');

      await userEvent.keyboard('[Tab]');

      await userEvent.keyboard(`[${ARROW_LEFT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '0');
      await userEvent.keyboard(`[${ARROW_LEFT}]`);
      expect(slider).toHaveAttribute('aria-valuenow', '0');
    });

    it('clamps range values that fall outside the min and max bounds', async () => {
      render(() => <TestRangeSlider defaultValue={[19, 41]} min={20} max={40} />);
      await settle();

      const thumbs = screen.getAllByRole('slider');

      expect(thumbs.map((thumb) => thumb.getAttribute('aria-valuenow'))).toEqual(['20', '40']);
    });
  });

  describe('prop: minStepsBetweenValues', () => {
    it('should enforce a minimum difference between range slider values', async () => {
      const handleValueChange = vi.fn();

      render(() => (
        <TestRangeSlider
          onValueChange={handleValueChange}
          defaultValue={[44, 50]}
          step={2}
          minStepsBetweenValues={2}
        />
      ));
      await settle();

      await userEvent.keyboard('[Tab]');

      await userEvent.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual([46, 50]);
      await userEvent.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(1);

      await userEvent.keyboard('[Tab]');

      await userEvent.keyboard(`[${ARROW_UP}]`);
      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual([46, 52]);
      await userEvent.keyboard(`[${ARROW_DOWN}]`);
      await userEvent.keyboard(`[${ARROW_DOWN}]`);
      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual([46, 50]);
    });
  });

  describe('prop: onValueCommitted', () => {
    it('single value', async () => {
      const handleValueCommitted = vi.fn((newValue: number, eventDetails: any) => ({
        newValue,
        reason: eventDetails.reason,
      }));

      render(() => (
        <Slider.Root onValueCommitted={handleValueCommitted} defaultValue={0}>
          <Slider.Control data-testid="control">
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      const slider = screen.getByRole('slider');

      fireEvent.pointerDown(sliderControl, {
        buttons: 1,
        clientX: 10,
      });
      flush();
      fireEvent.pointerUp(sliderControl, {
        buttons: 1,
        clientX: 10,
      });
      flush();

      expect(handleValueCommitted.mock.calls.length).toBe(1);
      expect(handleValueCommitted.mock.results.at(-1)?.value.newValue).toBe(10);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.trackPress);

      slider.focus();

      fireEvent.change(slider, { target: { value: 23 } });
      flush();
      expect(handleValueCommitted.mock.calls.length).toBe(2);
      expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
    });

    it('does not commit a canceled change', async () => {
      const handleValueChange = vi.fn((_value: unknown, details: any) => details.cancel());
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={50}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });
      flush();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit when keyboard interaction leaves the value unchanged', async () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={100}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();

      fireEvent.keyDown(slider, { key: ARROW_RIGHT });
      flush();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider).toHaveAttribute('aria-valuenow', '100');
    });

    it('does not commit when keyboard interaction leaves a range value unchanged', async () => {
      const handleValueChange = vi.fn();
      const handleValueCommitted = vi.fn();

      render(() => (
        <TestRangeSlider
          defaultValue={[50, 50]}
          onValueChange={handleValueChange}
          onValueCommitted={handleValueCommitted}
        />
      ));
      await settle();

      const [slider1, slider2] = screen.getAllByRole('slider');
      slider1.focus();

      fireEvent.keyDown(slider1, { key: ARROW_RIGHT });
      flush();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(handleValueCommitted).not.toHaveBeenCalled();
      expect(slider1).toHaveAttribute('aria-valuenow', '50');
      expect(slider2).toHaveAttribute('aria-valuenow', '50');
    });
  });

  describe('events', () => {
    it('should focus the slider when dragging', async () => {
      render(() => <TestSlider defaultValue={30} step={10} />);
      await settle();
      const slider = screen.getByRole('slider');
      const sliderThumb = screen.getByTestId('thumb');
      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      fireEvent.pointerDown(sliderThumb, {
        buttons: 1,
        clientX: 1,
      });

      await waitFor(() => {
        expect(slider).toHaveFocus();
      });
    });

    it('should not override the event.target on mouse events', async () => {
      const handleValueChange = vi.fn();
      const handleNativeEvent = vi.fn();
      const handleEvent = vi.fn();

      document.addEventListener('mousedown', handleNativeEvent);
      try {
        render(() => (
          <div onMouseDown={handleEvent}>
            <TestSlider value={0} onValueChange={handleValueChange} />
          </div>
        ));
        await settle();
        const sliderControl = screen.getByTestId('control');

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );

        fireEvent.mouseDown(sliderControl);
        flush();

        expect(handleValueChange.mock.calls.length).toBe(0);
        expect(handleNativeEvent.mock.calls.length).toBe(1);
        expect(handleNativeEvent.mock.calls[0][0]).toHaveProperty('target', sliderControl);
        expect(handleEvent.mock.calls.length).toBe(1);
        expect(handleEvent.mock.calls[0][0]).toHaveProperty('target', sliderControl);
      } finally {
        document.removeEventListener('mousedown', handleNativeEvent);
      }
    });
  });

  describe('prop: onValueChange', () => {
    it('is called when clicking on the control', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);
      await settle();

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      fireEvent.pointerDown(sliderControl, {
        buttons: 1,
        clientX: 41,
      });
      flush();

      expect(handleValueChange.mock.calls.length).toBe(1);
    });

    it('is not called when clicking on the thumb', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);
      await settle();

      const sliderControl = screen.getByTestId('control');
      const sliderThumb = screen.getByTestId('thumb');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      fireEvent.pointerDown(sliderThumb, {
        buttons: 1,
        clientX: 51,
      });
      flush();

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not react to right clicks', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={50} onValueChange={handleValueChange} />);
      await settle();

      const sliderControl = screen.getByTestId('control');

      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      fireEvent.pointerDown(sliderControl, {
        button: 2,
        clientX: 41,
      });
      flush();

      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('provides the change reason for input events', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={30} onValueChange={handleValueChange} />);
      await settle();

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '35' } });
      flush();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      const [, details] = handleValueChange.mock.calls[0] as [
        number,
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.inputChange);
      expect(details.activeThumbIndex).toBe(0);
    });

    it('provides the change reason for keyboard interactions', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={40} onValueChange={handleValueChange} />);
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();
      fireEvent.keyDown(slider, { key: ARROW_RIGHT });
      flush();

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      const [, details] = handleValueChange.mock.calls[0] as [
        number,
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe('keyboard');
    });

    it('provides the change reason for track presses', async () => {
      const handleValueChange = vi.fn();
      render(() => <TestSlider defaultValue={0} onValueChange={handleValueChange} />);
      await settle();

      const sliderControl = screen.getByTestId('control');
      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);

      fireEvent.pointerDown(sliderControl, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: 80,
        clientY: 0,
      });
      flush();

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      const [, details] = handleValueChange.mock.calls[0] as [
        number | number[],
        SliderRoot.ChangeEventDetails,
      ];
      expect(details.reason).toBe(REASONS.trackPress);
    });

    it('should pass "name" and "value" as part of the event.target for onValueChange', async () => {
      const handleValueChange = vi
        .fn()
        .mockImplementation((_newValue, data) => (data as any).event.target);

      render(() => (
        <TestSlider onValueChange={handleValueChange} name="change-testing" value={3} />
      ));
      await settle();

      const slider = screen.getByRole('slider');

      slider.focus();
      fireEvent.change(slider, {
        target: {
          value: 4,
        },
      });
      flush();

      expect(handleValueChange.mock.calls.length).toBe(1);
      const target = handleValueChange.mock.results[0]?.value;
      expect(target).toEqual({
        name: 'change-testing',
        value: 4,
      });
    });

    it('should not rely on the global event when cloning change events', async () => {
      const hadGlobalEvent = Object.prototype.hasOwnProperty.call(globalThis, 'event');
      const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'event');
      const globalEventConstructor = class {
        constructor() {
          throw new Error('Should not construct global event');
        }
      };
      const fakeGlobalEvent = {
        type: 'click',
        constructor: globalEventConstructor,
      };

      Object.defineProperty(globalThis, 'event', {
        configurable: true,
        get() {
          return fakeGlobalEvent;
        },
        set() {
          // Ignore assignments from the event system to ensure we never use it.
        },
      });

      try {
        const handleValueChange = vi.fn();

        render(() => (
          <TestSlider onValueChange={handleValueChange} name="change-testing" value={3} />
        ));
        await settle();

        const slider = screen.getByRole('slider');

        slider.focus();

        expectVitest(() => {
          fireEvent.change(slider, {
            target: {
              value: 4,
            },
          });
          flush();
        }).not.toThrow();

        expectVitest(handleValueChange).toHaveBeenCalledTimes(1);
      } finally {
        if (hadGlobalEvent && previousDescriptor) {
          Object.defineProperty(globalThis, 'event', previousDescriptor);
        } else {
          delete (globalThis as any).event;
        }
      }
    });
  });

  describe('keyboard interactions', () => {
    (
      [
        ['ltr', 'horizontal', [ARROW_LEFT, ARROW_DOWN], [ARROW_RIGHT, ARROW_UP]],
        ['ltr', 'vertical', [ARROW_LEFT, ARROW_DOWN], [ARROW_RIGHT, ARROW_UP]],
        ['rtl', 'horizontal', [ARROW_RIGHT, ARROW_DOWN], [ARROW_LEFT, ARROW_UP]],
        ['rtl', 'vertical', [ARROW_RIGHT, ARROW_DOWN], [ARROW_LEFT, ARROW_UP]],
      ] as Array<[TextDirection, Orientation, string[], string[]]>
    ).forEach(([direction, orientation, decrementKeys, incrementKeys]) => {
      describe(String(direction), () => {
        describe(`orientation: ${orientation}`, () => {
          decrementKeys.forEach((key) => {
            it(`key: ${key} decrements the value`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`[${key}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(19);
              expect(input).toHaveAttribute('aria-valuenow', '19');
            });

            it(`key: ${key} decrements the value by largeStep when Shift is pressed`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={10}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`{Shift>}{${key}}`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(10);
              expect(input).toHaveAttribute('aria-valuenow', '10');
            });

            it(`key: ${key} stops at min when decrementing while Shift is pressed`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={10}
                      min={15}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`{Shift>}{${key}}`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(15);
              expect(input).toHaveAttribute('aria-valuenow', '15');
            });
          });

          incrementKeys.forEach((key) => {
            it(`key: ${key} increments the value`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`[${key}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(21);
              expect(input).toHaveAttribute('aria-valuenow', '21');
            });

            it(`key: ${key} rounds fractional values to the configured step`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={0.2}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`[${key}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(0.3);
              expect(input).toHaveAttribute('aria-valuenow', '0.3');
            });

            it(`key: ${key} increments the value by largeStep when Shift is pressed`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={10}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`{Shift>}{${key}}`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(30);
              expect(input).toHaveAttribute('aria-valuenow', '30');
            });

            it(`key: ${key} stops at max when incrementing while Shift is pressed`, async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={10}
                      max={21}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`{Shift>}{${key}}`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(21);
              expect(input).toHaveAttribute('aria-valuenow', '21');
            });
          });

          describe('key: End', () => {
            it('sets value to max in a single value slider', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      max={77}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`[${END}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(77);
              expect(input).toHaveAttribute('aria-valuenow', '77');
            });

            it('sets value to the maximum possible value in a range slider', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root defaultValue={[20, 50]} max={77} onValueChange={handleValueChange}>
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb index={0} />
                          <Slider.Thumb index={1} />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const [input1, input2] = screen.getAllByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input1).toHaveFocus();

              await userEvent.keyboard(`[${END}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual([50, 50]);
              await userEvent.keyboard(`[${END}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);

              await userEvent.keyboard('[Tab]');
              expect(input2).toHaveFocus();

              await userEvent.keyboard(`[${END}]`);
              expect(handleValueChange.mock.calls.length).toBe(2);
              expect(handleValueChange.mock.calls[1][0]).toEqual([50, 77]);
            });
          });

          describe('key: Home', () => {
            it('sets value to min in a single value slider', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      min={17}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard(`[${HOME}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(17);
              expect(input).toHaveAttribute('aria-valuenow', '17');
            });

            it('sets value to the minimum possible value in a range slider', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root defaultValue={[20, 50]} min={7} onValueChange={handleValueChange}>
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb index={0} />
                          <Slider.Thumb index={1} />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const [input1, input2] = screen.getAllByRole('slider');

              await userEvent.keyboard('[Tab]');
              await userEvent.keyboard('[Tab]');
              expect(input2).toHaveFocus();

              await userEvent.keyboard(`[${HOME}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual([20, 20]);
              await userEvent.keyboard(`[${HOME}]`);
              expect(handleValueChange.mock.calls.length).toBe(1);

              await userEvent.keyboard('{Shift>}{Tab}');
              expect(input1).toHaveFocus();

              await userEvent.keyboard(`[${HOME}]`);
              expect(handleValueChange.mock.calls.length).toBe(2);
              expect(handleValueChange.mock.calls[1][0]).toEqual([7, 20]);
            });
          });

          describe('key: PageUp', () => {
            it('increments the value by largeStep', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={5}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard('[PageUp]');
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(25);
              expect(input).toHaveAttribute('aria-valuenow', '25');
            });

            it('preserves largeStep increments when step uses a different grid', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      step={2}
                      largeStep={5}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard('[PageUp]');
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(25);
              expect(input).toHaveAttribute('aria-valuenow', '25');
            });

            it('does not exceed max', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={5}
                      max={21}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard('[PageUp]');
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(21);
              expect(input).toHaveAttribute('aria-valuenow', '21');
            });
          });

          describe('key: PageDown', () => {
            it('decrements the value by largeStep', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={5}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard('[PageDown]');
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(15);
              expect(input).toHaveAttribute('aria-valuenow', '15');
            });

            it('does not go below min', async () => {
              const handleValueChange = vi.fn();
              render(() => (
                <div dir={direction}>
                  <DirectionProvider direction={direction}>
                    <Slider.Root
                      orientation={orientation}
                      defaultValue={20}
                      largeStep={5}
                      min={17}
                      onValueChange={handleValueChange}
                    >
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Indicator />
                          <Slider.Thumb data-testid="thumb" />
                        </Slider.Track>
                      </Slider.Control>
                    </Slider.Root>
                  </DirectionProvider>
                </div>
              ));
              await settle();

              const input = screen.getByRole('slider');

              await userEvent.keyboard('[Tab]');
              expect(input).toHaveFocus();

              await userEvent.keyboard('[PageDown]');
              expect(handleValueChange.mock.calls.length).toBe(1);
              expect(handleValueChange.mock.calls[0][0]).toEqual(17);
              expect(input).toHaveAttribute('aria-valuenow', '17');
            });
          });
        });
      });

      it('keypresses should correct invalid values', async () => {
        function App() {
          const [val, setVal] = createSignal(5.4698);
          return (
            <Slider.Root
              value={val()}
              onValueChange={(next) => setVal(next as number)}
              min={0}
              max={10}
              step={1}
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          );
        }
        render(() => <App />);
        await settle();

        const input = screen.getByRole('slider');

        expect(input).toHaveAttribute('aria-valuenow', '5.4698');
        await userEvent.keyboard('[Tab]');
        expect(input).toHaveFocus();
        await userEvent.keyboard(`[${ARROW_RIGHT}]`);
        expect(input).toHaveAttribute('aria-valuenow', '6');
      });
    });
  });

  describe('prop: format', () => {
    it('formats the value', async () => {
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, USD_NUMBER_FORMAT).format(v);
      }

      render(() => <TestSlider defaultValue={50} format={USD_NUMBER_FORMAT} />);
      await settle();

      const value = screen.getByTestId('value');
      const slider = screen.getByRole('slider');
      expect(value.textContent).toBe(formatValue(50));
      expect(slider).toHaveAttribute('aria-valuetext', formatValue(50));
    });

    it('recomputes the thumb aria text when the format option changes', async () => {
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, USD_NUMBER_FORMAT).format(v);
      }

      const [format, setFormat] = createSignal<Intl.NumberFormatOptions | undefined>(undefined);
      render(() => <TestSlider defaultValue={50} format={format()} />);
      await settle();

      const slider = screen.getByRole('slider');
      expect(slider).not.toHaveAttribute('aria-valuetext');

      setFormat(USD_NUMBER_FORMAT);
      await settle();

      expect(slider).toHaveAttribute('aria-valuetext', formatValue(50));
    });

    it('formats range values', async () => {
      function formatValue(v: number) {
        return new Intl.NumberFormat(undefined, USD_NUMBER_FORMAT).format(v);
      }

      render(() => <TestRangeSlider defaultValue={[50, 75]} format={USD_NUMBER_FORMAT} />);
      await settle();

      const value = screen.getByTestId('value');
      expect(value.textContent).toBe(`${formatValue(50)} – ${formatValue(75)}`);
      const [slider1, slider2] = screen.getAllByRole('slider');
      expect(slider1).toHaveAttribute('aria-valuetext', `${formatValue(50)} start range`);
      expect(slider2).toHaveAttribute('aria-valuetext', `${formatValue(75)} end range`);
    });
  });

  describe('prop: locale', () => {
    it('sets the locale when formatting a single value', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const expectedValue = new Intl.NumberFormat('de-DE', format).format(70.51);

      render(() => <TestSlider value={70.51} format={format} step={0.01} locale="de-DE" />);
      await settle();

      expect(screen.getByTestId('value')).toHaveTextContent(expectedValue);
    });

    it('sets the locale when formatting a range value', async () => {
      const format: Intl.NumberFormatOptions = {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
      const expectedValue = `${new Intl.NumberFormat('de-DE', format).format(24.8)} – ${new Intl.NumberFormat('de-DE', format).format(70.51)}`;

      render(() => (
        <TestRangeSlider value={[24.8, 70.51]} format={format} step={0.01} locale="de-DE" />
      ));
      await settle();

      expect(screen.getByTestId('value')).toHaveTextContent(expectedValue);
    });
  });

  describe('Form', () => {
    it('clears external errors on change', async () => {
      render(() => (
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <TestSlider data-testid="slider" defaultValue={50} />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));
      await settle();

      const slider = screen.getByRole('slider');

      expect(slider).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).toHaveTextContent('test');

      await userEvent.keyboard('[Tab]');
      expect(slider).toHaveFocus();

      await userEvent.keyboard(`{Shift>}{ArrowRight}`);
      await settle();

      expect(slider).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      render(() => (
        <Field.Root disabled>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-disabled', '');
    });

    it('should receive name prop from Field.Root', async () => {
      render(() => (
        <Field.Root name="field-slider">
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      expect(screen.getByRole('slider')).toHaveAttribute('name', 'field-slider');
    });

    it('[data-touched]', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      fireEvent.focus(input);
      fireEvent.blur(input);
      flush();

      expect(root).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      fireEvent.change(input, { target: { value: 'value' } });
      await settle();

      expect(root).toHaveAttribute('data-dirty', '');
    });

    it('[data-dirty] with a range value', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root" defaultValue={[20, 40]}>
            <Slider.Control>
              <Slider.Thumb index={0} />
              <Slider.Thumb index={1} />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const [, input2] = screen.getAllByRole('slider');

      expect(root).not.toHaveAttribute('data-dirty');

      fireEvent.change(input2, { target: { value: '50' } });
      await settle();

      expect(root).toHaveAttribute('data-dirty', '');

      fireEvent.change(input2, { target: { value: '40' } });
      await settle();

      expect(root).not.toHaveAttribute('data-dirty');
    });

    it('[data-focused]', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="root">
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        </Field.Root>
      ));
      await settle();

      const root = screen.getByTestId('root');
      const input = screen.getByRole('slider');

      expect(root).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);
      flush();

      expect(root).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);
      flush();

      expect(root).not.toHaveAttribute('data-focused');
    });

    describe('prop: validate', () => {
      it('validationMode=onSubmit', async () => {
        render(() => (
          <Form>
            <Field.Root validate={(val) => ((val as number) > 90 ? 'error' : null)}>
              <Slider.Root defaultValue={99} data-testid="root">
                <Slider.Control>
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));
        await settle();

        const root = screen.getByTestId('root');
        const thumb = screen.getByTestId('thumb');
        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.change(input, { target: { value: '98' } });
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);
        expect(root).toHaveAttribute('data-invalid');
        expect(thumb).toHaveAttribute('data-invalid');

        fireEvent.change(input, { target: { value: '10' } });
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
        expect(root).not.toHaveAttribute('data-invalid');
        expect(input).not.toHaveAttribute('data-invalid');
        expect(root).toHaveAttribute('data-valid');
        expect(thumb).toHaveAttribute('data-valid');

        fireEvent.change(input, { target: { value: '94' } });
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByTestId('error')).not.toBe(null);

        fireEvent.change(input, { target: { value: '12' } });
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        expect(screen.queryByTestId('error')).toBe(null);
      });

      it('moves focus to the range input on invalid submit', async () => {
        render(() => (
          <Form>
            <Field.Root validate={() => 'error'}>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Thumb />
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));
        await settle();

        const input = screen.getByRole('slider');
        expect(input).not.toHaveFocus();

        fireEvent.click(screen.getByText('submit'));
        await settle();

        // Slider registers the range input as the field control, so invalid
        // submits focus the native input instead of the non-focusable wrapper.
        expect(input).toHaveFocus();
      });

      it('validationMode=onBlur', async () => {
        render(() => (
          <Field.Root
            validationMode="onBlur"
            validate={(value) => ((value as number) > 1 ? 'error' : null)}
          >
            <Slider.Root>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        ));
        await settle();

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        fireEvent.change(input, { target: { value: '2' } });
        await settle();
        expect(input).not.toHaveAttribute('aria-invalid');
        fireEvent.blur(input);
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validationMode=onChange', async () => {
        render(() => (
          <Field.Root
            validationMode="onChange"
            validate={(value) => (Number(value) === 1 ? 'error' : null)}
          >
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));
        await settle();

        const input = screen.getByRole('slider');
        expect(input).not.toHaveAttribute('aria-invalid');

        fireEvent.change(input, { target: { value: '1' } });
        await settle();
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });

      it('validates once when changed by the user', async () => {
        const validate = vi.fn();

        render(() => (
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={0}>
              <Slider.Control>
                <Slider.Thumb />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));
        await settle();

        await userEvent.keyboard('[Tab]');
        expect(screen.getByRole('slider')).toHaveFocus();

        await userEvent.keyboard(`[${ARROW_RIGHT}]`);
        await settle();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toBe(1);
      });

      it('validates once with an array value for range sliders when changed by the user', async () => {
        const validate = vi.fn();

        render(() => (
          <Field.Root validationMode="onChange" validate={validate}>
            <Slider.Root defaultValue={[0, 5]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));
        await settle();

        await userEvent.keyboard('[Tab]');
        expect(screen.getAllByRole('slider')[0]).toHaveFocus();

        await userEvent.keyboard(`[${ARROW_RIGHT}]`);
        await settle();

        expect(validate).toHaveBeenCalledTimes(1);
        expect(validate.mock.lastCall?.[0]).toEqual([1, 5]);
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => (Number(value) === 5 ? 'error' : null));

        function App() {
          const [value, setValue] = createSignal(0);

          return (
            <>
              <Field.Root validationMode="onChange" validate={validateSpy} name="volume">
                <Slider.Root value={value()} onValueChange={(next) => setValue(next as number)}>
                  <Slider.Control>
                    <Slider.Thumb />
                  </Slider.Control>
                </Slider.Root>
              </Field.Root>
              <button type="button" onClick={() => setValue(5)}>
                Set externally
              </button>
            </>
          );
        }

        render(() => <App />);
        await settle();

        const slider = screen.getByRole('slider');
        const toggle = screen.getByText('Set externally');

        expect(slider).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        fireEvent.click(toggle);
        await settle();

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe(5);
        expect(slider).toHaveAttribute('aria-invalid', 'true');
      });

      it('receives an array value for range sliders', async () => {
        const validateSpy = vi.fn();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        render(() => (
          <Form onSubmit={onSubmit}>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={[5, 12]}>
                <Slider.Control>
                  <Slider.Thumb index={0} />
                  <Slider.Thumb index={1} />
                </Slider.Control>
              </Slider.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));
        await settle();

        fireEvent.click(screen.getByText('submit'));
        await settle();
        expect(validateSpy.mock.calls.length).toBe(1);
        expect(validateSpy.mock.calls[0][0]).toEqual([5, 12]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not call validate on change when validationMode is omitted', async () => {
        const validateSpy = vi.fn();
        render(() => (
          <Form>
            <Field.Root validate={validateSpy}>
              <Slider.Root defaultValue={50}>
                <Slider.Control data-testid="control">
                  <Slider.Track>
                    <Slider.Thumb aria-label="Value" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        ));
        await settle();

        expect(validateSpy.mock.calls.length).toBe(0);

        const sliderControl = screen.getByTestId('control');
        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );
        fireEvent.pointerDown(sliderControl, { buttons: 1, clientX: 10 });
        fireEvent.pointerUp(sliderControl, { buttons: 1, clientX: 30 });
        await settle();

        expect(validateSpy.mock.calls.length).toBe(0);
      });
    });

    it('Field.Label', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
          <Field.Label data-testid="label" />
        </Field.Root>
      ));
      await settle();

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label', async () => {
      render(() => (
        <Slider.Root>
          <Slider.Label data-testid="label" />
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      expect(screen.getByRole('slider')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Slider.Label focuses slider on click', async () => {
      render(() => (
        <Slider.Root>
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      await userEvent.click(screen.getByTestId('label'));

      expect(screen.getByRole('slider')).toHaveFocus();
    });

    it('Slider.Label does not focus a thumb on click for range sliders', async () => {
      render(() => (
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label data-testid="label">Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb aria-label="Minimum price" />
              <Slider.Thumb aria-label="Maximum price" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      await userEvent.click(screen.getByTestId('label'));

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).not.toHaveFocus();
      expect(maximumSlider).not.toHaveFocus();
    });

    it('does not set aria-labelledby when getAriaLabel is provided', async () => {
      render(() => (
        <Slider.Root defaultValue={[20, 80]}>
          <Slider.Label>Price range</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb getAriaLabel={() => 'Minimum price'} />
              <Slider.Thumb getAriaLabel={() => 'Maximum price'} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const [minimumSlider, maximumSlider] = screen.getAllByRole('slider');
      expect(minimumSlider).toHaveAttribute('aria-label', 'Minimum price');
      expect(maximumSlider).toHaveAttribute('aria-label', 'Maximum price');
      expect(minimumSlider).not.toHaveAttribute('aria-labelledby');
      expect(maximumSlider).not.toHaveAttribute('aria-labelledby');
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      render(() => (
        <Slider.Root>
          <Slider.Control>
            <Slider.Thumb aria-label="Volume" />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      await waitFor(() => {
        expect(screen.getByRole('slider')).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('updates Slider.Label linkage when root id changes', async () => {
      const [id, setId] = createSignal('first');
      render(() => (
        <Slider.Root id={id()} defaultValue={30} data-testid="root">
          <Slider.Label data-testid="label">Volume</Slider.Label>
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      setId('second');
      await settle();

      await waitFor(() => {
        expect(screen.getByTestId('root')).toHaveAttribute('id', 'second');
      });
      const root = screen.getByTestId('root');
      const label = screen.getByTestId('label');
      const slider = screen.getByRole('slider');
      expect(label.id).toBe('second-label');
      expect(root).toHaveAttribute('aria-labelledby', label.id);
      expect(slider).toHaveAttribute('aria-labelledby', label.id);
    });

    it('Field.Description', async () => {
      render(() => (
        <Field.Root>
          <Slider.Root data-testid="slider" aria-describedby="external-description">
            <Slider.Control />
          </Slider.Root>
          <Field.Description data-testid="description" />
        </Field.Root>
      ));
      await settle();

      expect(screen.getByTestId('slider')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('unmount', () => {
    it('unmounts cleanly with conditional rendering', async () => {
      const [show, setShow] = createSignal(true);
      render(() => (
        <Show when={show()}>
          <TestRangeSlider defaultValue={[20, 40]} />
        </Show>
      ));
      await settle();

      expect(screen.getAllByRole('slider').length).toBe(2);

      setShow(false);
      await settle();

      expect(screen.queryAllByRole('slider').length).toBe(0);
    });
  });
});
