import { expect } from 'vitest';
import { flush } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { Radio } from '../../radio';
import { RadioGroup } from '../../radio-group';

async function flushMicrotasks() {
  flush();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  flush();
}

describe('<Radio.Indicator />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders the indicator only while the radio is checked', async () => {
    render(() => (
      <RadioGroup defaultValue="a">
        <Radio.Root value="a" data-testid="a">
          <Radio.Indicator data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" data-testid="b">
          <Radio.Indicator data-testid="indicator-b" />
        </Radio.Root>
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.queryByTestId('indicator-a')).not.toBe(null);
    expect(screen.queryByTestId('indicator-b')).toBe(null);
  });

  it('keeps the indicator mounted when keepMounted is true', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="a">
          <Radio.Indicator keepMounted data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>
    ));
    await flushMicrotasks();

    expect(screen.queryByTestId('indicator')).not.toBe(null);
    expect(screen.getByTestId('indicator')).toHaveAttribute('data-unchecked', '');
  });

  it('should apply data-checked and data-unchecked to radio root and indicator', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="a" data-testid="a">
          <Radio.Indicator keepMounted data-testid="indicator-a" />
        </Radio.Root>
        <Radio.Root value="b" data-testid="b">
          <Radio.Indicator keepMounted data-testid="indicator-b" />
        </Radio.Root>
      </RadioGroup>
    ));
    await flushMicrotasks();

    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');
    const indicatorA = screen.getByTestId('indicator-a');
    const indicatorB = screen.getByTestId('indicator-b');

    expect(a).toHaveAttribute('data-unchecked', '');
    expect(indicatorA).toHaveAttribute('data-unchecked', '');

    expect(b).toHaveAttribute('data-unchecked', '');
    expect(indicatorB).toHaveAttribute('data-unchecked', '');

    fireEvent.click(a);
    await flushMicrotasks();

    expect(a).toHaveAttribute('data-checked', '');
    expect(indicatorA).toHaveAttribute('data-checked', '');

    expect(b).toHaveAttribute('data-unchecked', '');
    expect(indicatorB).toHaveAttribute('data-unchecked', '');

    fireEvent.click(b);
    await flushMicrotasks();

    expect(a).toHaveAttribute('data-unchecked', '');
    expect(indicatorA).toHaveAttribute('data-unchecked', '');

    expect(b).toHaveAttribute('data-checked', '');
    expect(indicatorB).toHaveAttribute('data-checked', '');

    fireEvent.click(a);
    await flushMicrotasks();

    expect(a).toHaveAttribute('data-checked', '');
    expect(indicatorA).toHaveAttribute('data-checked', '');

    expect(b).toHaveAttribute('data-unchecked', '');
    expect(indicatorB).toHaveAttribute('data-unchecked', '');
  });

  it('inherits the disabled and required state attributes from the root', async () => {
    render(() => (
      <RadioGroup defaultValue="a" disabled required>
        <Radio.Root value="a">
          <Radio.Indicator data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>
    ));
    await flushMicrotasks();

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-required', '');
  });
});
