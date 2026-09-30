import { expect, vi } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Radio } from '../../radio';
import { RadioGroup } from '../../radio-group';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Radio.Root />', () => {
  it('renders a span with role="radio" and a hidden input beside', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="a" data-testid="radio" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    const radio = screen.getByTestId('radio');
    expect(radio.tagName).toBe('SPAN');
    expect(radio).toHaveAttribute('role', 'radio');
    expect(radio).toHaveAttribute('aria-checked', 'false');

    const input = radio.nextElementSibling as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'radio');
    expect(input).toHaveAttribute('aria-hidden', 'true');
  });

  it('sets checked and unchecked data attributes', async () => {
    render(() => (
      <RadioGroup defaultValue="checked">
        <Radio.Root value="checked" data-testid="checked" />
        <Radio.Root value="unchecked" data-testid="unchecked" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('checked')).toHaveAttribute('data-checked');
    expect(screen.getByTestId('checked')).not.toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).not.toHaveAttribute('data-checked');
  });

  it('uses string aria-checked values', async () => {
    render(() => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a" data-testid="a" />
        <Radio.Root value="b" data-testid="b" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('a').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('b').getAttribute('aria-checked')).toBe('false');
  });

  it('does not forward `value` prop', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="test" data-testid="radio-root" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.getByTestId('radio-root')).not.toHaveAttribute('value');
  });

  it('allows `null` value', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value={null} data-testid="radio-null" />
        <Radio.Root value="a" data-testid="radio-a" />
      </RadioGroup>
    ));
    await flushMicrotasks();

    const radioNull = screen.getByTestId('radio-null');
    const radioA = screen.getByTestId('radio-a');

    fireEvent.click(radioNull);
    await flushMicrotasks();
    expect(radioNull).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(radioA);
    await flushMicrotasks();
    expect(radioNull).toHaveAttribute('aria-checked', 'false');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    render(() => (
      <div>
        <label for="radio-input">Label</label>
        <RadioGroup>
          <Radio.Root value="a" id="radio-input" />
        </RadioGroup>
      </div>
    ));
    await flushMicrotasks();

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('radio')).toHaveAttribute('aria-labelledby', label.id);
  });

  describe('prop: onClick', () => {
    it('propagates a single click event to ancestors per user click', async () => {
      const handleParentClick = vi.fn();
      render(() => (
        <RadioGroup>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={handleParentClick}>
            <Radio.Root value="a" data-testid="radio" />
          </div>
        </RadioGroup>
      ));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('radio'));
      await flushMicrotasks();

      expect(handleParentClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate to ancestors when stopPropagation() is called', async () => {
      const handleParentClick = vi.fn();
      render(() => (
        <RadioGroup>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div onClick={handleParentClick}>
            <Radio.Root
              value="a"
              data-testid="radio"
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </div>
        </RadioGroup>
      ));
      await flushMicrotasks();

      fireEvent.click(screen.getByTestId('radio'));
      await flushMicrotasks();

      expect(handleParentClick).toHaveBeenCalledTimes(0);
      expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
    });

    it('does not propagate a click to ancestors when selecting with arrow keys', async () => {
      const handleParentClick = vi.fn();
      render(() => (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={handleParentClick}>
          <RadioGroup defaultValue="a">
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
        </div>
      ));
      await flushMicrotasks();

      await userEvent.click(screen.getByTestId('radio-a'));
      await flushMicrotasks();
      handleParentClick.mockClear();

      fireEvent.keyDown(screen.getByTestId('radio-a'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('radio-b')).toHaveAttribute('aria-checked', 'true');
      expect(handleParentClick).toHaveBeenCalledTimes(0);
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const radio = screen.getByTestId('radio');
      expect(radio).not.toHaveAttribute('disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables the hidden input', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const input = screen.getByTestId('radio').nextElementSibling as HTMLInputElement;
      expect(input).toHaveAttribute('disabled');
    });
  });

  describe('prop: required', () => {
    it('applies [data-required] and aria attributes', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" required data-testid="radio" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const radio = screen.getByTestId('radio');
      const input = radio.nextElementSibling as HTMLInputElement;

      expect(radio).toHaveAttribute('data-required', '');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('prop: readOnly', () => {
    it('applies [data-readonly] and prevents state changes', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" readOnly data-testid="radio" />
        </RadioGroup>
      ));
      await flushMicrotasks();

      const radio = screen.getByTestId('radio');
      expect(radio).toHaveAttribute('data-readonly', '');

      fireEvent.click(radio);
      await flushMicrotasks();

      expect(radio).toHaveAttribute('aria-checked', 'false');
    });
  });
});
