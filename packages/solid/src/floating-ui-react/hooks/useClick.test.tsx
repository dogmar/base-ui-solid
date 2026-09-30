import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { useClick } from './useClick';
import { useFloatingRootContext } from './useFloatingRootContext';
import { mergeProps } from '../../merge-props';
import type { UseClickProps } from './useClick';

function App(props: UseClickProps & { initiallyOpen?: boolean }) {
  const [open, setOpen] = createSignal(props.initiallyOpen ?? false, { ownedWrite: true });
  const [reference, setReference] = createSignal<Element | null>(null);
  const [floating, setFloating] = createSignal<HTMLElement | null>(null);

  const context = useFloatingRootContext({
    get open() {
      return open();
    },
    onOpenChange: (nextOpen: boolean) => setOpen(nextOpen),
    elements: {
      get reference() {
        return reference();
      },
      get floating() {
        return floating();
      },
    },
  });

  const click = useClick(context, props);

  return (
    <>
      <button
        {...mergeProps(click.reference, {})}
        ref={(el: HTMLButtonElement) => setReference(el)}
        data-testid="reference"
      />
      {open() && <div role="tooltip" ref={(el: HTMLDivElement) => setFloating(el)} />}
    </>
  );
}

describe('useClick', () => {
  it('opens on click and toggles closed on repeated click', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByRole } = render(() => <App />);
    const button = getByTestId('reference');

    await user.click(button);
    flush();
    expect(queryByRole('tooltip')).not.toBeNull();

    await user.click(button);
    flush();
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('does not close on repeated click when toggle is false', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByRole } = render(() => <App toggle={false} />);
    const button = getByTestId('reference');

    await user.click(button);
    flush();
    expect(queryByRole('tooltip')).not.toBeNull();

    await user.click(button);
    flush();
    expect(queryByRole('tooltip')).not.toBeNull();
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    const { getByTestId, queryByRole } = render(() => <App enabled={false} />);

    await user.click(getByTestId('reference'));
    flush();
    expect(queryByRole('tooltip')).toBeNull();
  });
});
