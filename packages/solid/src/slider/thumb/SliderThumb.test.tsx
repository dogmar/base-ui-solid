import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createRef } from '../../solid-utils/refs';
import { Slider } from '../index';
import { Field } from '../../field';

// The React suite additionally covers focus-visible restoration, inset
// re-measurement, drag positioning, and server-side rendering in
// Chromium-only tests (`describe.skipIf(isJSDOM)`); jsdom cannot measure
// layout, so those suites are intentionally not ported. The pre-hydration
// script suites do not apply to the Solid port.

async function settle() {
  flush();
  await Promise.resolve();
  flush();
  await Promise.resolve();
  flush();
}

describe('<Slider.Thumb />', () => {
  beforeAll(() => {
    (window as any).PointerEvent = window.MouseEvent;
  });

  it('sets the thumb index data attribute', async () => {
    render(() => (
      <Slider.Root defaultValue={50}>
        <Slider.Control>
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    expect(screen.getByTestId('thumb')).toHaveAttribute('data-index', '0');
  });

  describe('ARIA attributes', () => {
    (['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-valuetext'] as const).forEach(
      (attr) => {
        it(`forwards ${attr} to the input`, async () => {
          render(() => (
            <Slider.Root defaultValue={50}>
              <Slider.Control>
                <Slider.Thumb
                  {...{
                    [attr]: 'test',
                  }}
                />
              </Slider.Control>
            </Slider.Root>
          ));
          await settle();
          expect(screen.getByRole('slider')).toHaveAttribute(attr, 'test');
        });
      },
    );

    it('prefers getAriaValueText over a direct aria-valuetext prop', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              aria-valuetext="ignored"
              getAriaValueText={(formatted) => `${formatted} percent`}
            />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 percent');
    });
  });

  describe('prop: onKeyDown', () => {
    it('forwards key events that the slider does not handle', async () => {
      const handleKeyDown = vi.fn();
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();
      fireEvent.keyDown(slider, { key: 'Enter' });
      flush();
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    ['ArrowRight', 'PageUp'].forEach((key) => {
      it(`forwards handled ${key} key events`, async () => {
        const handleKeyDown = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onKeyDown={handleKeyDown} />
            </Slider.Control>
          </Slider.Root>
        ));
        await settle();

        const slider = screen.getByRole('slider');
        slider.focus();
        fireEvent.keyDown(slider, { key });
        flush();

        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      });
    });

    it('allows preventing the internal key handling', async () => {
      const handleKeyDown = vi.fn((event: KeyboardEvent) => {
        event.preventDefault();
      });

      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const slider = screen.getByRole('slider');
      slider.focus();
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      flush();

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('does not commit NaN when more thumbs are rendered than values', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();

      render(() => (
        <Slider.Root
          defaultValue={[10, 20]}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <Slider.Control>
            <Slider.Thumb />
            <Slider.Thumb />
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const extraThumb = screen.getAllByRole('slider')[2];
      extraThumb.focus();
      fireEvent.keyDown(extraThumb, { key: 'ArrowRight' });
      flush();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    describe('focus and blur', () => {
      it('forwards focus and blur to the input so `currentTarget` is the input', async () => {
        const focusSpy = vi.fn();
        const blurSpy = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                onFocus={(event) => focusSpy(event.currentTarget)}
                onBlur={(event) => blurSpy(event.currentTarget)}
              />
            </Slider.Control>
          </Slider.Root>
        ));
        await settle();

        await userEvent.keyboard('[Tab]');
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');

        await userEvent.keyboard('[Tab]');
        expect(blurSpy).toHaveBeenCalledTimes(1);
        expect(blurSpy.mock.calls[0][0]).toHaveProperty('tagName', 'INPUT');
      });

      it('does not commit field validation when moving focus between range thumbs', async () => {
        const validateSpy = vi.fn(() => null);
        render(() => (
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Slider.Root defaultValue={[20, 50]}>
              <Slider.Control>
                <Slider.Thumb index={0} />
                <Slider.Thumb index={1} />
              </Slider.Control>
            </Slider.Root>
          </Field.Root>
        ));
        await settle();

        const [thumb0, thumb1] = screen.getAllByRole('slider');

        await userEvent.keyboard('[Tab]');
        expect(thumb0).toHaveFocus();

        validateSpy.mockClear();

        await userEvent.keyboard('[Tab]');
        expect(thumb1).toHaveFocus();
        expect(validateSpy).not.toHaveBeenCalled();

        await userEvent.keyboard('[Tab]');
        expect(thumb1).not.toHaveFocus();
        await settle();
        expect(validateSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('change', () => {
      it('handles change events', async () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));
        await settle();

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        fireEvent.change(slider, { target: { value: '51' } });
        flush();
        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(slider).toHaveAttribute('aria-valuenow', '51');
      });

      it('does not change the value beyond min and max', async () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root defaultValue={50} min={40} max={60} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));
        await settle();

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');

        fireEvent.change(slider, { target: { value: '30' } });
        flush();
        expect(slider).toHaveAttribute('aria-valuenow', '40');
        expect(handleValueChange.mock.calls.length).toBe(1);
        fireEvent.change(slider, { target: { value: '30' } });
        flush();
        expect(handleValueChange.mock.calls.length).toBe(1);

        fireEvent.change(slider, { target: { value: '70' } });
        flush();
        expect(slider).toHaveAttribute('aria-valuenow', '60');
        expect(handleValueChange.mock.calls.length).toBe(2);
        fireEvent.change(slider, { target: { value: '70' } });
        flush();
        expect(handleValueChange.mock.calls.length).toBe(2);
      });

      it('handles non-integer values', async () => {
        const handleValueChange = vi.fn();
        render(() => (
          <Slider.Root
            defaultValue={50}
            min={-100}
            max={100}
            step={0.00000001}
            onValueChange={handleValueChange}
          >
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>
        ));
        await settle();

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        expect(slider).toHaveAttribute('step', '1e-8');

        fireEvent.change(slider, { target: { value: '51.1' } });
        flush();
        expect(slider).toHaveAttribute('aria-valuenow', '51.1');

        fireEvent.change(slider, { target: { value: '0.00000005' } });
        flush();
        expect(slider).toHaveAttribute('aria-valuenow', '5e-8');

        fireEvent.change(slider, { target: { value: '1e-7' } });
        flush();
        expect(slider).toHaveAttribute('aria-valuenow', '1e-7');
      });
    });
  });

  describe('prop: tabIndex', () => {
    it('does not apply tabIndex to the thumb element by default', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      expect(screen.getByTestId('thumb')).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', 0);
    });

    it('can be removed from the tab sequence', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb tabIndex={-1} />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', -1);
      expect(document.body).toHaveFocus();
      await userEvent.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
    });
  });

  describe('prop: children', () => {
    it('renders the nested input as a sibling to children', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb">
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the element form render prop', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render={<div data-testid="thumb" />}>
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the function form render prop', async () => {
      render(() => (
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render={(props) => <div data-testid="thumb" {...props} />}>
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });
  });

  describe('prop: inputRef', () => {
    it('can focus the input element', async () => {
      function App() {
        const inputRef = createRef<HTMLInputElement>();
        return (
          <>
            <Slider.Root defaultValue={50}>
              <Slider.Control>
                <Slider.Thumb inputRef={inputRef} />
              </Slider.Control>
            </Slider.Root>
            <button
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }}
            >
              Button
            </button>
          </>
        );
      }
      render(() => <App />);
      await settle();

      expect(document.body).toHaveFocus();
      await userEvent.click(screen.getByText('Button'));
      expect(screen.getByRole('slider')).toHaveFocus();
    });
  });

  it('preserves the grab offset when dragging a vertical thumb', async () => {
    const onValueChange = vi.fn();

    render(() => (
      <Slider.Root defaultValue={50} orientation="vertical" onValueChange={onValueChange}>
        <Slider.Control data-testid="control">
          <Slider.Thumb data-testid="thumb" />
        </Slider.Control>
      </Slider.Root>
    ));
    await settle();

    const control = screen.getByTestId('control');
    const thumb = screen.getByTestId('thumb');
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 10, 100));
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 10, 20));

    fireEvent.pointerDown(thumb, { button: 0, buttons: 1, clientX: 5, clientY: 60 });
    fireEvent.pointerMove(document.body, { buttons: 1, clientX: 5, clientY: 80 });
    flush();

    expect(onValueChange).toHaveBeenLastCalledWith(
      30,
      expect.objectContaining({ activeThumbIndex: 0, reason: 'drag' }),
    );
  });

  describe('stacking order', () => {
    it('relies on DOM order before any thumb is used', async () => {
      render(() => (
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      expect(screen.getByTestId('thumb-0').style.zIndex).toBe('');
      expect(screen.getByTestId('thumb-1').style.zIndex).toBe('');
    });

    it('keeps the most recently active thumb on top after focus moves away', async () => {
      render(() => (
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>
      ));
      await settle();

      const [thumb0, thumb1] = [screen.getByTestId('thumb-0'), screen.getByTestId('thumb-1')];

      await userEvent.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[0]).toHaveFocus();
      expect(thumb0.style.zIndex).toBe('2');

      await userEvent.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('2');

      await userEvent.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('1');
      expect(thumb0.style.zIndex).toBe('');
    });
  });
});
