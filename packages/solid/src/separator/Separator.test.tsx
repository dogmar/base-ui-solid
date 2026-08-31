import { createSignal, flush } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { Separator } from '.';

describe('<Separator />', () => {
  it('renders a div with role="separator"', () => {
    const { container } = render(() => <Separator />);
    const separator = container.firstElementChild as HTMLElement;
    expect(separator.tagName).toBe('DIV');
    expect(separator).toHaveAttribute('role', 'separator');
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
  });

  it('applies orientation reactively', () => {
    const [orientation, setOrientation] = createSignal<'horizontal' | 'vertical'>('horizontal');
    const { container } = render(() => <Separator orientation={orientation()} />);
    const separator = container.firstElementChild as HTMLElement;
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');

    setOrientation('vertical');
    flush();
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute('data-orientation', 'vertical');
  });

  it('supports className as a string and merges class', () => {
    const { container } = render(() => <Separator className="a" class="b" />);
    const separator = container.firstElementChild as HTMLElement;
    expect(separator.classList.contains('a')).toBe(true);
    expect(separator.classList.contains('b')).toBe(true);
  });

  it('supports className as a state function', () => {
    const { container } = render(() => (
      <Separator orientation="vertical" className={(state) => `sep-${state.orientation}`} />
    ));
    const separator = container.firstElementChild as HTMLElement;
    expect(separator.classList.contains('sep-vertical')).toBe(true);
  });

  it('forwards other props and children', () => {
    const { getByTestId } = render(() => (
      <Separator data-testid="sep" id="my-separator">
        <span data-testid="child" />
      </Separator>
    ));
    const separator = getByTestId('sep');
    expect(separator).toHaveAttribute('id', 'my-separator');
    expect(getByTestId('child')).toBeInTheDocument();
  });

  it('supports the render prop function form', () => {
    const { container } = render(() => (
      <Separator
        orientation="vertical"
        render={(props, state) => <hr {...props} data-state-orientation={state.orientation} />}
      />
    ));
    const separator = container.firstElementChild as HTMLElement;
    expect(separator.tagName).toBe('HR');
    expect(separator).toHaveAttribute('role', 'separator');
    expect(separator).toHaveAttribute('data-state-orientation', 'vertical');
  });

  it('supports the render prop element form', () => {
    const { container } = render(() => <Separator render={<hr class="base" />} />);
    const separator = container.firstElementChild as HTMLElement;
    expect(separator.tagName).toBe('HR');
    expect(separator).toHaveAttribute('role', 'separator');
    expect(separator.classList.contains('base')).toBe(true);
  });

  it('keeps render prop function form reactive', () => {
    const [orientation, setOrientation] = createSignal<'horizontal' | 'vertical'>('horizontal');
    const { container } = render(() => (
      <Separator orientation={orientation()} render={(props) => <hr {...props} />} />
    ));
    const separator = container.firstElementChild as HTMLElement;
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    setOrientation('vertical');
    flush();
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('keeps render prop element form reactive', () => {
    const [orientation, setOrientation] = createSignal<'horizontal' | 'vertical'>('horizontal');
    const { container } = render(() => (
      <Separator orientation={orientation()} render={<hr class="base" />} />
    ));
    const separator = container.firstElementChild as HTMLElement;
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    setOrientation('vertical');
    flush();
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator.classList.contains('base')).toBe(true);
  });

  it('calls refs with the rendered element', () => {
    let called: HTMLElement | null = null;
    render(() => <Separator ref={(el: HTMLElement | null) => (called = el)} data-testid="sep" />);
    expect(called).not.toBeNull();
    expect((called as unknown as HTMLElement).tagName).toBe('DIV');
  });

  it('merges user event handlers', () => {
    const onClick = vi.fn();
    const { container } = render(() => <Separator onClick={onClick} />);
    (container.firstElementChild as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
