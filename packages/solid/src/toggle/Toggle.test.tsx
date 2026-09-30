import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Toggle } from '.';

describe('<Toggle />', () => {
  it('renders a button with type="button" and aria-pressed', () => {
    const { getByRole } = render(() => <Toggle />);
    const button = getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles pressed state on click (uncontrolled)', async () => {
    const onPressedChange = vi.fn();
    const { getByRole } = render(() => <Toggle onPressedChange={onPressedChange} />);
    const button = getByRole('button');

    await userEvent.click(button);
    flush();
    expect(onPressedChange).toHaveBeenCalledTimes(1);
    expect(onPressedChange.mock.calls[0][0]).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-pressed');

    await userEvent.click(button);
    flush();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveAttribute('data-pressed');
  });

  it('respects the controlled pressed prop', async () => {
    const [pressed, setPressed] = createSignal(false);
    const { getByRole } = render(() => <Toggle pressed={pressed()} />);
    const button = getByRole('button');

    await userEvent.click(button);
    flush();
    // Controlled: does not change without parent update.
    expect(button).toHaveAttribute('aria-pressed', 'false');

    setPressed(true);
    flush();
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports defaultPressed', () => {
    const { getByRole } = render(() => <Toggle defaultPressed />);
    expect(getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('cancelling eventDetails prevents state change', async () => {
    const { getByRole } = render(() => (
      <Toggle onPressedChange={(_pressed, details) => details.cancel()} />
    ));
    const button = getByRole('button');
    await userEvent.click(button);
    flush();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not react when disabled', async () => {
    const onPressedChange = vi.fn();
    const { getByRole } = render(() => <Toggle disabled onPressedChange={onPressedChange} />);
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled');
  });

  it('renders as a non-native button via nativeButton={false}', () => {
    const { getByRole } = render(() => (
      <Toggle nativeButton={false} render={(props) => <div {...props} />} />
    ));
    const button = getByRole('button');
    expect(button.tagName).toBe('DIV');
    expect(button).toHaveAttribute('role', 'button');
    expect(button).toHaveAttribute('tabindex', '0');
  });

  it('activates with keyboard on non-native buttons', async () => {
    const onPressedChange = vi.fn();
    const { getByRole } = render(() => (
      <Toggle
        nativeButton={false}
        onPressedChange={onPressedChange}
        render={(props) => <div {...props} />}
      />
    ));
    const button = getByRole('button');
    (button as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    flush();
    expect(onPressedChange).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
