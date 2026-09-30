import { render, screen } from '@solidjs/testing-library';
import { Switch } from '../index';
import { SwitchRootContext } from '../root/SwitchRootContext';
import { createRef } from '../../solid-utils/refs';

const testContext: SwitchRootContext = {
  checked: false,
  disabled: false,
  readOnly: false,
  required: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  valid: null,
};

describe('<Switch.Thumb />', () => {
  it('renders a span', () => {
    render(() => (
      <SwitchRootContext value={testContext}>
        <Switch.Thumb data-testid="thumb" />
      </SwitchRootContext>
    ));

    expect(screen.getByTestId('thumb').tagName).toBe('SPAN');
  });

  it('forwards the ref', () => {
    const ref = createRef<HTMLElement>();
    render(() => (
      <SwitchRootContext value={testContext}>
        <Switch.Thumb data-testid="thumb" ref={ref} />
      </SwitchRootContext>
    ));

    expect(ref.current).toBe(screen.getByTestId('thumb'));
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('throws a descriptive error when rendered outside <Switch.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Switch.Thumb />)).toThrow(
        'Base UI: SwitchRootContext is missing. Switch parts must be placed within <Switch.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
