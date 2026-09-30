import { render } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { Button } from '.';

describe('<Button />', () => {
  it('renders a native button with type="button"', () => {
    const { getByRole } = render(() => <Button>Click</Button>);
    const button = getByRole('button');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const { getByRole } = render(() => <Button onClick={onClick}>Click</Button>);
    await userEvent.click(getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    const { getByRole } = render(() => (
      <Button disabled onClick={onClick}>
        Click
      </Button>
    ));
    const button = getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-disabled');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays focusable when focusableWhenDisabled is true', () => {
    const { getByRole } = render(() => (
      <Button disabled focusableWhenDisabled>
        Click
      </Button>
    ));
    const button = getByRole('button');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    (button as HTMLElement).focus();
    expect(document.activeElement).toBe(button);
  });

  it('supports rendering as a non-native element', async () => {
    const onClick = vi.fn();
    const { getByRole } = render(() => (
      <Button nativeButton={false} onClick={onClick} render={(props) => <span {...props} />} />
    ));
    const button = getByRole('button');
    expect(button.tagName).toBe('SPAN');
    expect(button).toHaveAttribute('tabindex', '0');
    (button as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
