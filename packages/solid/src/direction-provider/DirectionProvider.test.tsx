import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { DirectionProvider, useDirection, type TextDirection } from '.';

function DirectionProbe() {
  const direction = useDirection();
  return <span data-testid="direction">{direction()}</span>;
}

describe('<DirectionProvider />', () => {
  it('defaults useDirection to ltr outside a provider', () => {
    const { getByTestId } = render(() => <DirectionProbe />);

    expect(getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('provides the configured direction to descendants', () => {
    const [direction, setDirection] = createSignal<TextDirection>('rtl', { ownedWrite: true });
    const { getByTestId } = render(() => (
      <DirectionProvider direction={direction()}>
        <DirectionProbe />
      </DirectionProvider>
    ));

    expect(getByTestId('direction')).toHaveTextContent('rtl');

    setDirection('ltr');
    flush();

    expect(getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('defaults to ltr when no direction is passed', () => {
    const { getByTestId } = render(() => (
      <DirectionProvider>
        <DirectionProbe />
      </DirectionProvider>
    ));

    expect(getByTestId('direction')).toHaveTextContent('ltr');
  });
});
