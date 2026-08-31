import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';

function Hello(props: { name: string }) {
  return <div data-testid="hello">Hello {props.name}</div>;
}

describe('solid toolchain smoke test', () => {
  it('renders a component', () => {
    const { getByTestId } = render(() => <Hello name="Solid" />);
    expect(getByTestId('hello')).toHaveTextContent('Hello Solid');
  });

  it('updates reactively', () => {
    const [name, setName] = createSignal('one');
    const { getByTestId } = render(() => <Hello name={name()} />);
    setName('two');
    flush();
    expect(getByTestId('hello')).toHaveTextContent('Hello two');
  });
});
