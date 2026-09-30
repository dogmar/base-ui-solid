import { render, screen } from '@solidjs/testing-library';
import { Checkbox } from '../index';
import { CheckboxRootContext } from '../root/CheckboxRootContext';
import { createRef } from '../../solid-utils/refs';

const testContext: CheckboxRootContext = {
  checked: true,
  disabled: false,
  readOnly: false,
  required: false,
  indeterminate: false,
  dirty: false,
  touched: false,
  valid: null,
  filled: false,
  focused: false,
};

describe('<Checkbox.Indicator />', () => {
  beforeEach(() => {
    (globalThis as Record<string, any>).BASE_UI_ANIMATIONS_DISABLED = true;
  });

  it('renders a span', () => {
    render(() => (
      <CheckboxRootContext value={testContext}>
        <Checkbox.Indicator data-testid="indicator" />
      </CheckboxRootContext>
    ));

    expect(screen.getByTestId('indicator').tagName).toBe('SPAN');
  });

  it('forwards the ref', () => {
    const ref = createRef<HTMLElement>();
    render(() => (
      <CheckboxRootContext value={testContext}>
        <Checkbox.Indicator data-testid="indicator" ref={ref} />
      </CheckboxRootContext>
    ));

    expect(ref.current).toBe(screen.getByTestId('indicator'));
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('throws a descriptive error when rendered outside <Checkbox.Root>', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(() => render(() => <Checkbox.Indicator />)).toThrow(
        'Base UI: CheckboxRootContext is missing. Checkbox parts must be placed within <Checkbox.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('should not render indicator by default', () => {
    render(() => (
      <Checkbox.Root>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    const indicator = screen.queryByTestId('indicator');
    expect(indicator).toBe(null);
  });

  it('should render indicator when checked', () => {
    render(() => (
      <Checkbox.Root checked>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator).not.toBe(null);
  });

  it('should render indicator when indeterminate', () => {
    render(() => (
      <Checkbox.Root indeterminate>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator).not.toBe(null);
  });

  it('should spread extra props', () => {
    render(() => (
      <Checkbox.Root defaultChecked>
        <Checkbox.Indicator data-testid="indicator" data-extra-prop="Lorem ipsum" />
      </Checkbox.Root>
    ));
    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-extra-prop', 'Lorem ipsum');
  });

  describe('prop: keepMounted', () => {
    it('should keep indicator mounted when unchecked', () => {
      render(() => (
        <Checkbox.Root>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
      expect(indicator).toHaveAttribute('data-unchecked', '');
    });

    it('should keep indicator mounted when checked', () => {
      render(() => (
        <Checkbox.Root checked>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
      expect(indicator).toHaveAttribute('data-checked', '');
    });

    it('should keep indicator mounted when indeterminate', () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>
      ));
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
      expect(indicator).toHaveAttribute('data-indeterminate', '');
    });
  });
});
